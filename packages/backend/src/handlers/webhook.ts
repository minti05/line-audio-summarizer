import { Env } from '../types/env';
import { validateSignature } from '../core/security';
import { getContent, replyMessage, replyFlexMessage, replyWelcomeMessage, replyPromptModeSelection, startLoadingAnimation } from '../services/line';
import { generateSummary } from '../services/gemini';
import { getPublicKey, addToInbox, getUserConfig, upsertUserConfig, getWebhookConfig, upsertWebhookConfig } from '../services/db';
import { encryptWithPublicKey } from '../services/crypto';
import { setTempState, getTempState } from '../services/kv';
import { sendToWebhook } from '../services/webhook';
import { getSystemPrompt, PromptMode } from '../core/prompts';

export async function webhookHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('x-line-signature');
    if (!signature) {
        return new Response('Missing Signature', { status: 401 });
    }

    const body = await request.text();

    // 署名の検証
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

                        // ユーザー設定の確認
                        const userConfig = await getUserConfig(env.DB, userId);
                        const confirmMode = userConfig ? userConfig.confirm_mode : 1; // デフォルト ON

                        // プロンプトの解決
                        const promptMode = (userConfig?.prompt_mode as PromptMode) || 'memo';
                        const systemPrompt = getSystemPrompt(promptMode, userConfig?.custom_prompt);

                        // 0. ローディング表示
                        await startLoadingAnimation(userId, env.LINE_CHANNEL_ACCESS_TOKEN);

                        // 1. 音声コンテンツの取得
                        const audioBuffer = await getContent(messageId, env.LINE_CHANNEL_ACCESS_TOKEN);

                        // 2. 要約の生成
                        const summary = await generateSummary(audioBuffer, 'audio/m4a', env.GEMINI_API_KEY, systemPrompt);

                        if (confirmMode === 0) {
                            // 自動保存モード
                            await saveToInbox(env, userId, summary, replyToken);
                        } else {
                            // 確認モード
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
                            const mode = params.get('mode') as PromptMode;
                            if (['diary', 'todo', 'memo', 'brainstorm'].includes(mode)) {
                                const userConfig = await getUserConfig(env.DB, userId);
                                await upsertUserConfig(env.DB, {
                                    line_user_id: userId,
                                    confirm_mode: userConfig?.confirm_mode ?? 1,
                                    prompt_mode: mode,
                                    custom_prompt: userConfig?.custom_prompt || null
                                });
                                await replyMessage(replyToken, `✅ モードを「${mode}」に変更しました。`, env.LINE_CHANNEL_ACCESS_TOKEN);
                            }
                        }
                    }
                    else if (event.type === 'message' && event.message.type === 'text') {
                        const text = event.message.text.trim();

                        // プロンプト入力待ちかどうか確認
                        const promptStateKey = `prompt_setting_state:${userId}`;
                        const isSettingPrompt = await getTempState(env.LINE_AUDIO_KV, promptStateKey);

                        if (isSettingPrompt) {
                            // キャンセル/確認キーワードのチェック
                            if (text === 'キャンセル' || text === '変更なし' || text === '変更しない' || text === 'OK' || text === '確認') {
                                // 状態をクリア
                                await env.LINE_AUDIO_KV.delete(promptStateKey);
                                const replyText = (text === 'OK' || text === '確認')
                                    ? "確認しました。現在のプロンプトを維持します。"
                                    : "変更をキャンセルしました。";
                                await replyMessage(event.replyToken, replyText, env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            // リセットキーワードのチェック
                            if (text === 'リセット') {
                                const userConfig = await getUserConfig(env.DB, userId);
                                await upsertUserConfig(env.DB, {
                                    line_user_id: userId,
                                    confirm_mode: userConfig?.confirm_mode ?? 1,
                                    prompt_mode: 'memo',
                                    custom_prompt: null // リセット
                                });
                                await env.LINE_AUDIO_KV.delete(promptStateKey);
                                await replyMessage(event.replyToken, `✅ プロンプトを標準に戻しました。`, env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            // カスタムプロンプトの更新
                            const userConfig = await getUserConfig(env.DB, userId);
                            await upsertUserConfig(env.DB, {
                                line_user_id: userId,
                                confirm_mode: userConfig?.confirm_mode ?? 1,
                                prompt_mode: 'custom',
                                custom_prompt: text
                            });

                            // 状態をクリア
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
                            const promptStatus = userConfig?.prompt_mode === 'custom' ? 'Custom' :
                                (userConfig?.prompt_mode || 'memo (標準)');
                            const webhookStatus = webhookConfig?.webhook_url ? '設定済み' : '未設定';
                            const obsidianStatus = publicKey ? '連携済み (公開鍵登録完了)' : '未連携 (公開鍵未登録)';

                            const statusText = `【現在のステータス】\n\n` +
                                `📱 **Obsidian連携**: ${obsidianStatus}\n` +
                                `🔌 **Webhook連携**: ${webhookStatus}\n` +
                                `📝 **プロンプト**: ${promptStatus}\n` +
                                `✅ **確認モード**: ${confirmStatus}`;

                            await replyMessage(event.replyToken, statusText, env.LINE_CHANNEL_ACCESS_TOKEN);

                        } else if (text === '/help' || text === 'ヘルプ') {
                            const helpText = "【コマンド一覧】\n/id : User ID確認\n/confirm : 確認モード切替 (ON/OFF)\n/prompt : AIプロンプト設定とモード切替\n/webhook : Webhook連携設定\n/status : ステータス確認\n/help : ヘルプ表示\n\n音声メッセージを要約し、ObsidianやWebhook先へ送信します。";
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
                            const currentMode = config?.prompt_mode || 'memo';
                            const currentPrompt = config?.custom_prompt || "未設定 (標準)";

                            const msg = `【プロンプト設定】\n現在のモード: ${currentMode}\nカスタムプロンプト: ${currentPrompt}\n\n👇 モードを変更するには下のボタンを押してください。\n\n✏️ カスタムプロンプトを変更するには、このメッセージに返信する形で新しいプロンプトを入力してください。\n(「リセット」と送信すると標準に戻ります)`;

                            await replyPromptModeSelection(event.replyToken, env.LINE_CHANNEL_ACCESS_TOKEN);
                            // Note: replyPromptModeSelection will send a message. But we want to send the text explanation too?
                            // replyFlexMessage sends ONE message.
                            // If we want two messages (Text + Flex), we need to call replyMessage (push message?)
                            // Line Reply Token can only be used ONCE.
                            // So we cannot call replyMessage then replyPromptModeSelection.
                            // We should handle this by sending a Flex Bubble that *contains* the explanation?
                            // OR, since replyPromptModeSelection is generic, maybe we should just send text explanation as part of the next turn?
                            // No, User Experience.
                            // Let's modify replyPromptModeSelection to accept "Allow Text?" No.
                            // Let's just reply with a single message.
                            // The Flex Message in replyPromptModeSelection already has "モード選択" title.
                            // Let's just use that.
                            // But we also want to allow "Custom Prompt Input".

                            // Solution: Send prompt mode selection.
                            // Also set "waiting" state for Custom Prompt input?
                            // Yes, allow user to input text OR click button.

                            await setTempState(env.LINE_AUDIO_KV, `prompt_setting_state:${userId}`, 'waiting', 300);
                        } else if (text.startsWith('/webhook')) {
                            const parts = text.split(/\s+/);
                            const url = parts.length > 1 ? parts[1] : null;

                            // Help / Empty check
                            if (!url) {
                                const helpMsg = "【Webhook設定】\n\nn8nやMakeなどのWebhook URLを設定することで、要約完了時にJSONデータを送信できます。\n\n📝 **設定方法**:\n`/webhook <URL>`\n\n例:\n`/webhook https://hooks.zapier.com/...`";
                                await replyMessage(event.replyToken, helpMsg, env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            // Validation
                            try {
                                new URL(url); // Simple URL validation
                                if (!url.startsWith('https://')) {
                                    throw new Error('HTTPS required');
                                }
                            } catch (e) {
                                await replyMessage(event.replyToken, "🚫 無効なURLです。\n\n`https://` で始まる正しいURLを入力してください。", env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            // Save
                            await upsertWebhookConfig(env.DB, {
                                line_user_id: userId,
                                webhook_url: url,
                                secret_token: null, // Future use
                                config: null
                            });

                            await replyMessage(event.replyToken, `✅ Webhook URLを設定しました。\n\n今後、要約データがこちらに送信されます:\n${url}`, env.LINE_CHANNEL_ACCESS_TOKEN);
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
    // 暗号化して保存
    const publicKeyPem = await getPublicKey(env.DB, userId);
    if (!publicKeyPem) {
        await replyMessage(replyToken, '公開鍵が見つかりません。Obsidianからデバイス登録を行ってください。', env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
    }

    const encrypted = await encryptWithPublicKey(summary, publicKeyPem);
    await addToInbox(env.DB, userId, encrypted.encryptedData, encrypted.iv, encrypted.encryptedKey);

    await replyMessage(replyToken, 'Inboxに保存しました (暗号化済み)。Obsidianを開いて同期してください。', env.LINE_CHANNEL_ACCESS_TOKEN);

    // Webhookの確認
    try {
        const webhookConfig = await getWebhookConfig(env.DB, userId);
        if (webhookConfig && webhookConfig.webhook_url) {
            await sendToWebhook(webhookConfig.webhook_url, {
                event: 'summary_generated',
                userId: userId,
                summary: summary,
                timestamp: Date.now()
            });
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
