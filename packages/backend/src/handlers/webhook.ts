import { Env } from '../types/env';
import { validateSignature } from '../core/security';
import { getContent, replyMessage, replyFlexMessage, replyWelcomeMessage, replyPromptModeSelection } from '../services/line';
import { generateSummary } from '../services/gemini';
import { getSystemPrompt, PromptMode } from '../core/prompts';
import { getPublicKey, addToInbox } from '../services/db';
import { encryptWithPublicKey } from '../services/crypto';
import { setTempState, getTempState } from '../services/kv';
import { sendToWebhook } from '../services/webhook';

import { getUserConfig, upsertUserConfig, getWebhookConfig, upsertWebhookConfig } from '../services/db';

// ... (existing imports)

export async function webhookHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('x-line-signature');
    if (!signature) {
        return new Response('Missing Signature', { status: 401 });
    }

    const body = await request.text();

    // Validate Signature
    const isValid = await validateSignature(body, env.LINE_CHANNEL_SECRET, signature);
    if (!isValid) {
        return new Response('Invalid Signature', { status: 403 });
    }

    try {
        const data = JSON.parse(body);
        const events = data.events;

        ctx.waitUntil((async () => {
            await Promise.all(events.map(async (event: any) => {
                try {
                    const userId = event.source.userId;

                    if (event.type === 'follow') {
                        await replyWelcomeMessage(event.replyToken, env.LINE_CHANNEL_ACCESS_TOKEN);
                    }
                    else if (event.type === 'message' && event.message.type === 'audio') {
                        const messageId = event.message.id;
                        const replyToken = event.replyToken;

                        // Check User Config
                        // Check User Config
                        const userConfig = await getUserConfig(env.DB, userId);
                        const confirmMode = userConfig ? userConfig.confirm_mode : 1; // Default ON
                        const promptMode = (userConfig?.prompt_mode as PromptMode) || 'memo';
                        const customPrompt = userConfig?.custom_prompt || null;

                        const systemPrompt = getSystemPrompt(promptMode, customPrompt);

                        // 1. Get Audio Content
                        const audioBuffer = await getContent(messageId, env.LINE_CHANNEL_ACCESS_TOKEN);

                        // 2. Generate Summary
                        const summary = await generateSummary(audioBuffer, 'audio/m4a', env.GEMINI_API_KEY, systemPrompt);

                        if (confirmMode === 0) {
                            // Auto Save Mode
                            await saveToInbox(env, userId, summary, replyToken);
                        } else {
                            // Confirm Mode
                            const sessionId = crypto.randomUUID();
                            await setTempState(env.LINE_AUDIO_KV, `session:${sessionId}`, summary, 600);
                            await sendConfirmationFlex(replyToken, summary, sessionId, env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                    }
                    else if (event.type === 'postback') {
                        const replyToken = event.replyToken;
                        const params = new URLSearchParams(event.postback.data);
                        const action = params.get('action');
                        const sessionId = params.get('session_id');

                        if (action === 'save' && sessionId) {
                            const summary = await getTempState<string>(env.LINE_AUDIO_KV, `session:${sessionId}`);
                            if (!summary) {
                                await replyMessage(replyToken, '有効期限切れのセッションです。', env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }
                            await saveToInbox(env, userId, summary, replyToken);
                        }
                        else if (action === 'discard') {
                            await replyMessage(replyToken, '破棄しました。', env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                        else if (action === 'set_mode') {
                            const mode = params.get('mode') as any;
                            // Verify mode validity
                            if (['diary', 'todo', 'memo', 'brainstorm'].includes(mode)) {
                                const config = await getUserConfig(env.DB, userId);
                                await upsertUserConfig(env.DB, {
                                    line_user_id: userId,
                                    confirm_mode: config?.confirm_mode ?? 1,
                                    prompt_mode: mode,
                                    custom_prompt: null // Reset custom prompt when switching standard modes
                                });
                                // Map internal mode to display name
                                const modeNames: { [key: string]: string } = {
                                    diary: '日記モード',
                                    todo: 'TODO抽出',
                                    memo: '気づき・メモ',
                                    brainstorm: 'アイデア壁打ち'
                                };
                                await replyMessage(replyToken, `✅ ${modeNames[mode]} に切り替えました。`, env.LINE_CHANNEL_ACCESS_TOKEN);
                            }
                        }
                    }
                    else if (event.type === 'message' && event.message.type === 'text') {
                        const text = event.message.text.trim();

                        // Check if waiting for prompt input
                        const promptStateKey = `prompt_setting_state:${userId}`;
                        const isSettingPrompt = await getTempState(env.LINE_AUDIO_KV, promptStateKey);

                        if (isSettingPrompt) {
                            // Check for Cancel/Confirm keywords
                            if (text === 'キャンセル' || text === '変更なし' || text === '変更しない' || text === 'OK' || text === '確認') {
                                // Clear state
                                await env.LINE_AUDIO_KV.delete(promptStateKey);
                                const replyText = (text === 'OK' || text === '確認')
                                    ? "確認しました。現在のプロンプトを維持します。"
                                    : "変更をキャンセルしました。";
                                await replyMessage(event.replyToken, replyText, env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            // Check for Reset keyword
                            if (text === 'リセット') {
                                const userConfig = await getUserConfig(env.DB, userId);
                                await upsertUserConfig(env.DB, {
                                    line_user_id: userId,
                                    confirm_mode: userConfig?.confirm_mode ?? 1,
                                    prompt_mode: 'memo',
                                    custom_prompt: null // Reset
                                });
                                await env.LINE_AUDIO_KV.delete(promptStateKey);
                                await replyMessage(event.replyToken, `✅ プロンプトを標準に戻しました。`, env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            // Update Custom Prompt
                            const userConfig = await getUserConfig(env.DB, userId);
                            await upsertUserConfig(env.DB, {
                                line_user_id: userId,
                                confirm_mode: userConfig?.confirm_mode ?? 1,
                                prompt_mode: 'custom',
                                custom_prompt: text
                            });

                            // Clear state
                            await setTempState(env.LINE_AUDIO_KV, promptStateKey, 'set', 0);
                            await env.LINE_AUDIO_KV.delete(promptStateKey);

                            await replyMessage(event.replyToken, `✅ カスタムプロンプトを設定しました。\n\n現在の設定:\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`, env.LINE_CHANNEL_ACCESS_TOKEN);
                            return;
                        }

                        if (text === '/id') {
                            await replyMessage(event.replyToken, `あなたの LINE User ID はこちらです:\n${userId}\n\nこのIDを Obsidian の設定画面に入力してください。`, env.LINE_CHANNEL_ACCESS_TOKEN);
                        } else if (text === '/status' || text === 'ステータス') {
                            const userConfig = await getUserConfig(env.DB, userId);
                            const webhookConfig = await getWebhookConfig(env.DB, userId);
                            const publicKey = await getPublicKey(env.DB, userId);

                            const confirmStatus = (userConfig?.confirm_mode ?? 1) === 1 ? 'ON (確認してから保存)' : 'OFF (自動保存)';
                            const promptStatus = userConfig?.prompt_mode === 'custom' ? 'Custom' : 'Standard';
                            const webhookStatus = webhookConfig?.webhook_url ? '設定済み' : '未設定';
                            const obsidianStatus = publicKey ? '連携済み (公開鍵登録完了)' : '未連携 (公開鍵未登録)';

                            const statusText = `【現在のステータス】\n\n` +
                                `📱 **Obsidian連携**: ${obsidianStatus}\n` +
                                `🔌 **Webhook連携**: ${webhookStatus}\n` +
                                `📝 **プロンプト**: ${promptStatus}\n` +
                                `✅ **確認モード**: ${confirmStatus}`;

                            await replyMessage(event.replyToken, statusText, env.LINE_CHANNEL_ACCESS_TOKEN);

                        } else if (text === '/help' || text === 'ヘルプ') {
                            const helpText = "【コマンド一覧】\n/id : User ID確認\n/confirm : 確認モード切替 (ON/OFF)\n/prompt : AIプロンプト設定\n/webhook : Webhook連携設定\n/status : ステータス確認\n/help : ヘルプ表示\n\n音声メッセージを要約し、ObsidianやWebhook先へ送信します。";
                            await replyMessage(event.replyToken, helpText, env.LINE_CHANNEL_ACCESS_TOKEN);
                        } else if (text === '/confirm' || text === '確認モード') {
                            const config = await getUserConfig(env.DB, userId);
                            const currentMode = config ? config.confirm_mode : 1;
                            const newMode = currentMode === 1 ? 0 : 1;

                            await upsertUserConfig(env.DB, {
                                line_user_id: userId,
                                confirm_mode: newMode,
                                prompt_mode: config?.prompt_mode || 'memo',
                                custom_prompt: config?.custom_prompt || null
                            });

                            const modeText = newMode === 1 ? "ON (確認してから保存)" : "OFF (自動保存)";
                            await replyMessage(event.replyToken, `確認モードを ${modeText} に変更しました。`, env.LINE_CHANNEL_ACCESS_TOKEN);
                        } else if (text === '/prompt') {
                            const config = await getUserConfig(env.DB, userId);
                            const currentPrompt = config?.custom_prompt || "デフォルト (標準)";

                            const msg = `現在のプロンプト:\n\n${currentPrompt}\n\n✏️ 変更するには、このメッセージに返信する形で新しいプロンプトを入力してください。\n\n・変更しない場合は「キャンセル」または「変更なし」と送信してください。\n・標準に戻す場合は「リセット」と送信してください。`;

                            // Set state to wait for input (TTL 5 mins)
                            await setTempState(env.LINE_AUDIO_KV, `prompt_setting_state:${userId}`, 'waiting', 300);

                            // Show current prompt and offer mode switch
                            const msg1 = `現在のプロンプトモード: 【${config?.prompt_mode || 'memo'}】\n\nもしモードを変更したい場合は、下の「モード変更」と送信するか、メニューを利用してください。`;

                            // For simplicity, we trigger the mode selection menu if they type /prompt
                            // But per original design, /prompt was for Custom Prompt editing.
                            // Let's combine: Show Status -> If user wants to edit custom, they reply text. If they want to switch mode, we show a button?

                            // Let's just send the text prompt AND the mode selection carousel together? 
                            // No, LINE only allows 5 bubbles or one reply.

                            await replyPromptModeSelection(event.replyToken, env.LINE_CHANNEL_ACCESS_TOKEN);
                        } else if (text === 'モード変更' || text === '/mode') {
                            await replyPromptModeSelection(event.replyToken, env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                    }
                }
                catch (err: any) {
                    console.error('Error processing event:', err);
                    // Error reply logic...
                }
            }));
        })());

        return new Response('OK', { status: 200 });

    } catch (e) {
        console.error('Error processing webhook:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
}

async function saveToInbox(env: Env, userId: string, summary: string, replyToken: string) {
    // Encrypt and Save
    const publicKeyPem = await getPublicKey(env.DB, userId);
    if (!publicKeyPem) {
        await replyMessage(replyToken, '公開鍵が見つかりません。Obsidianからデバイス登録を行ってください。', env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
    }

    const encrypted = await encryptWithPublicKey(summary, publicKeyPem);
    await addToInbox(env.DB, userId, encrypted.encryptedData, encrypted.iv, encrypted.encryptedKey);

    await replyMessage(replyToken, 'Inboxに保存しました (暗号化済み)。Obsidianを開いて同期してください。', env.LINE_CHANNEL_ACCESS_TOKEN);

    // Check for Webhook
    try {
        const webhookConfig = await getWebhookConfig(env.DB, userId);
        if (webhookConfig && webhookConfig.webhook_url) {
            await sendToWebhook(webhookConfig.webhook_url, {
                event: 'summary_generated',
                userId: userId,
                summary: summary,
                timestamp: Date.now()
            });
            // Optional: Notify user that webhook was sent? Maybe too verbose.
        }
    } catch (e) {
        console.error('Webhook trigger failed:', e);
    }
}

async function sendConfirmationFlex(replyToken: string, summary: string, sessionId: string, accessToken: string) {
    const bubble = {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: "要約が作成されました",
                    weight: "bold",
                    size: "xl"
                },
                {
                    type: "separator",
                    margin: "md"
                },
                {
                    type: "text",
                    text: summary.substring(0, 300) + (summary.length > 300 ? "..." : ""),
                    wrap: true,
                    margin: "md",
                    size: "sm"
                }
            ]
        },
        footer: {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
                {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    action: {
                        type: "postback",
                        label: "保存 (暗号化)",
                        data: `action=save&session_id=${sessionId}`,
                        displayText: "保存 (暗号化)"
                    }
                },
                {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                        type: "postback",
                        label: "破棄",
                        data: `action=discard&session_id=${sessionId}`,
                        displayText: "破棄"
                    }
                }
            ]
        }
    };
    await replyFlexMessage(replyToken, "要約が作成されました", bubble, accessToken);
}
