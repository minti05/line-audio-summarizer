import { Env } from '../types/env';
import { validateSignature } from '../core/security';
import { getContent, replyMessage, replyFlexMessage, replyWelcomeMessage, replyPromptModeSelection, startLoadingAnimation, replyInitialSetupMessages, replyMessages, createModeSelectionBubble, pushMessage, replyChangeTargetMessages } from '../services/line';
import { generateSummary } from '../services/gemini';
import { getPublicKey, addToInbox, getUserConfig, upsertUserConfig, getWebhookConfig, upsertWebhookConfig } from '../services/db';
import { encryptWithPublicKey } from '../services/crypto';
import { setTempState, getTempState } from '../services/kv';
import { sendToWebhook } from '../services/webhook';
import { getSystemPrompt, PromptMode, PROMPT_MODE_DETAILS } from '../core/prompts';
import { createConfirmationBubble, createSetupCompleteBubble, IntegrationType } from '../services/flex';

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
                        await replyInitialSetupMessages(event.replyToken, env.LINE_CHANNEL_ACCESS_TOKEN);
                        return;
                    }

                    if (event.type === 'unfollow') {
                        console.log(`User ${userId} unfollowed. Cleaning up data.`);
                        await env.DB.prepare('DELETE FROM PublicKeys WHERE line_user_id = ?').bind(userId).run();
                        await env.DB.prepare('DELETE FROM WebhookConfigs WHERE line_user_id = ?').bind(userId).run();
                        await env.DB.prepare('DELETE FROM UserConfigs WHERE line_user_id = ?').bind(userId).run();
                        await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);
                        await env.LINE_AUDIO_KV.delete(`prompt_setting_state:${userId}`);
                        return;
                    }

                    // Setup Status Check
                    const integrationType = await determineIntegrationType(env.DB, userId);
                    const userConfig = await getUserConfig(env.DB, userId);

                    // Setup is done if integration is enabled OR user config exists (manual skip)
                    const isSetupDone = integrationType !== 'none' || !!userConfig;

                    const setupState = await getTempState<string>(env.LINE_AUDIO_KV, `setup_state:${userId}`);

                    if (!isSetupDone || setupState) {
                        await handleSetupMode(event, env, userId, setupState);
                        return;
                    }

                    if (event.type === 'message' && event.message.type === 'audio') {
                        const messageId = event.message.id;
                        const replyToken = event.replyToken;

                        // ユーザー設定の確認
                        const userConfig = await getUserConfig(env.DB, userId);
                        const confirmMode = userConfig ? userConfig.confirm_mode : 1; // デフォルト ON

                        // プロンプトの解決
                        const promptMode = (userConfig?.prompt_mode as PromptMode) || PromptMode.Memo;
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
                            // 投稿前確認モード
                            const sessionId = crypto.randomUUID();
                            const label = promptMode === PromptMode.Custom ? 'Custom' : PROMPT_MODE_DETAILS[promptMode as Exclude<PromptMode, PromptMode.Custom>].label;
                            await setTempState(env.LINE_AUDIO_KV, `session:${sessionId}`, summary, 600);

                            const bubble = createConfirmationBubble(summary, sessionId, label, integrationType);
                            await replyFlexMessage(replyToken, "要約が作成されました", bubble, env.LINE_CHANNEL_ACCESS_TOKEN);
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
                            const promptStateKey = `prompt_setting_state:${userId}`;
                            const isSettingPrompt = await getTempState(env.LINE_AUDIO_KV, promptStateKey);

                            if (!isSettingPrompt) {
                                await replyMessage(replyToken, 'モード選択の有効期限が切れています。\n再度 /prompt コマンドを実行してください。', env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            const mode = params.get('mode') as PromptMode;
                            // Custom以外の有効なモードか確認
                            if (mode in PROMPT_MODE_DETAILS) {
                                const userConfig = await getUserConfig(env.DB, userId);
                                await upsertUserConfig(env.DB, {
                                    line_user_id: userId,
                                    confirm_mode: userConfig?.confirm_mode ?? 1,
                                    prompt_mode: mode,
                                    custom_prompt: userConfig?.custom_prompt || null
                                });
                                // 状態をクリア
                                await env.LINE_AUDIO_KV.delete(promptStateKey);

                                const label = PROMPT_MODE_DETAILS[mode as Exclude<PromptMode, PromptMode.Custom>].label;
                                const bubble = createSetupCompleteBubble(`「${label}」に設定しました`, "思考整理の準備が整いました。");
                                await replyFlexMessage(replyToken, "設定完了", bubble, env.LINE_CHANNEL_ACCESS_TOKEN);
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

                            // カスタムプロンプトの更新
                            const userConfig = await getUserConfig(env.DB, userId);
                            await upsertUserConfig(env.DB, {
                                line_user_id: userId,
                                confirm_mode: userConfig?.confirm_mode ?? 1,
                                prompt_mode: PromptMode.Custom,
                                custom_prompt: text
                            });

                            // 状態をクリア
                            await env.LINE_AUDIO_KV.delete(promptStateKey);

                            const bubble = createSetupCompleteBubble("カスタムプロンプトを設定", `現在の設定:\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
                            await replyFlexMessage(event.replyToken, "設定完了", bubble, env.LINE_CHANNEL_ACCESS_TOKEN);
                            return;
                        }
                        if (text === '/confirm' || text === '投稿前確認モード') {
                            const config = await getUserConfig(env.DB, userId);
                            const currentMode = config ? config.confirm_mode : 1;
                            const newMode = currentMode === 1 ? 0 : 1;

                            await upsertUserConfig(env.DB, {
                                line_user_id: userId,
                                confirm_mode: newMode,
                                prompt_mode: config?.prompt_mode || PromptMode.Memo,
                                custom_prompt: config?.custom_prompt || null
                            });

                            const modeText = newMode === 1 ? "ON (確認してから保存)" : "OFF (自動保存)";
                            await replyMessage(event.replyToken, `投稿前確認モードを ${modeText} に変更しました。`, env.LINE_CHANNEL_ACCESS_TOKEN);
                        } else if (text === '/prompt') {
                            const config = await getUserConfig(env.DB, userId);
                            const currentModeKey = (config?.prompt_mode as PromptMode) || PromptMode.Memo;
                            const currentModeLabel = currentModeKey === PromptMode.Custom ? 'Custom' : PROMPT_MODE_DETAILS[currentModeKey as Exclude<PromptMode, PromptMode.Custom>]?.label;

                            const currentPrompt = config?.custom_prompt || "未設定 (標準)";

                            const msg = `【プロンプト設定】\n現在のモード: ${currentModeLabel}\nカスタムプロンプト: ${currentPrompt}\n\n👇 モードを変更するには下のボタンを押してください。`;

                            await askForModeSelection(env, userId, event.replyToken, [
                                { type: 'text', text: msg }
                            ]);
                        } else if (text === '/change' || text === '変更') {
                            await replyChangeTargetMessages(event.replyToken, env.LINE_CHANNEL_ACCESS_TOKEN);
                            await setTempState(env.LINE_AUDIO_KV, `setup_state:${userId}`, 'changing_target', 300);
                        } else {
                            // コマンド以外はステータスとヘルプを表示
                            const userConfig = await getUserConfig(env.DB, userId);
                            const webhookConfig = await getWebhookConfig(env.DB, userId);
                            const publicKey = await getPublicKey(env.DB, userId);

                            const confirmStatus = (userConfig?.confirm_mode ?? 1) === 1 ? 'ON' : 'OFF';
                            const promptStatus = userConfig?.prompt_mode === PromptMode.Custom ? 'Custom' :
                                (PROMPT_MODE_DETAILS[userConfig?.prompt_mode as Exclude<PromptMode, PromptMode.Custom>]?.label || PROMPT_MODE_DETAILS[PromptMode.Memo].label);
                            const webhookStatus = webhookConfig?.webhook_url ? '設定済' : '未設定';
                            const obsidianStatus = publicKey ? '連携済' : '未連携';

                            const message = `【現在のステータス】\n` +
                                `📱 Obsidian: ${obsidianStatus}\n` +
                                `🔌 Webhook: ${webhookStatus}\n` +
                                `📝 プロンプト: ${promptStatus}\n` +
                                `✅ 投稿前確認モード: ${confirmStatus}\n\n` +
                                `【コマンド一覧】\n` +
                                `/confirm : 投稿前確認モード切替\n` +
                                `/prompt : プロンプト変更\n` +
                                `/change : 連携先変更\n\n` +
                                `音声メッセージを送ると要約を開始します。`;

                            await replyMessage(event.replyToken, message, env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                    }
                }
                catch (err: any) {
                    console.error('Error processing event:', err);
                    try {
                        // エラーが発生した場合、ユーザーに通知を試みる (デバッグ用)
                        if (event.source && event.source.userId) {
                            await pushMessage(event.source.userId, `システムエラーが発生しました:\n${err.message}`, env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                    } catch (e) {
                        console.error('Failed to send error notification:', e);
                    }
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



async function handleSetupMode(event: any, env: Env, userId: string, currentState: any): Promise<void> {
    const replyToken = event.replyToken;
    const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN;

    if (event.type === 'postback') {
        console.log('[Setup] Postback received:', event.postback.data); // LOG ADDED
        const params = new URLSearchParams(event.postback.data);
        const action = params.get('action');
        console.log('[Setup] Action parsed:', action); // LOG ADDED

        if (action === 'setup_obsidian') {
            await replyMessages(replyToken, [
                { type: 'text', text: `あなたのUser IDは以下です。コピーしてObsidianの設定に入力してください。` },
                { type: 'text', text: userId },
                { type: 'text', text: `設定が完了したら、このチャットに「完了」や「OK」など、何かメッセージを送ってください。\nそれをもって連携確認を行います。` }
            ], accessToken);
            await setTempState(env.LINE_AUDIO_KV, `setup_state:${userId}`, 'waiting_for_obsidian', 86400); // 1 day wait
        } else if (action === 'setup_webhook') {
            await replyMessages(replyToken, [
                { type: 'text', text: `連携するWebhook URL (https://...) を入力して送信してください。` }
            ], accessToken);
            await setTempState(env.LINE_AUDIO_KV, `setup_state:${userId}`, 'waiting_for_webhook', 3600); // 1 hour wait
        } else if (action === 'setup_nothing') {
            await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);

            // 既存の設定をクリア（連携先切り替えの意図があるため）
            await env.DB.prepare('DELETE FROM PublicKeys WHERE line_user_id = ?').bind(userId).run();
            await env.DB.prepare('DELETE FROM WebhookConfigs WHERE line_user_id = ?').bind(userId).run();

            // 設定なし利用として記録
            await upsertUserConfig(env.DB, {
                line_user_id: userId,
                confirm_mode: 1,
                prompt_mode: PromptMode.Memo,
                custom_prompt: null
            });

            await askForModeSelection(env, userId, replyToken, [
                { type: 'text', text: `設定を「連携なし」に変更しました。` }
            ]);
        } else {
            await replyInitialSetupMessages(replyToken, accessToken);
        }
        return;
    }

    if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();

        // キャンセル処理
        if (['キャンセル', 'cancel', '戻る', 'やめる'].includes(text)) {
            await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);
            await replyMessage(replyToken, "変更をキャンセルしました。", accessToken);
            return;
        }

        if (currentState === 'waiting_for_obsidian') {
            const hasKey = await getPublicKey(env.DB, userId);
            if (hasKey) {
                await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);
                await askForModeSelection(env, userId, replyToken, [
                    { type: 'text', text: "✅ Obsidian連携が確認できました！" }
                ]);
            } else {
                await replyMessage(replyToken, "🚫 まだ連携が確認できませんでした。\nObsidian側で設定を行い、再度メッセージを送ってください。", accessToken);
            }
        } else if (currentState === 'waiting_for_webhook') {
            if (text.startsWith('https://')) {
                await upsertWebhookConfig(env.DB, { line_user_id: userId, webhook_url: text, secret_token: null, config: null });
                await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);
                await askForModeSelection(env, userId, replyToken, [
                    { type: 'text', text: "✅ Webhook連携を設定しました！" }
                ]);
            } else {
                await replyMessage(replyToken, "🚫 無効なURLです。https:// から始まるURLを入力してください。", accessToken);
            }
        } else {
            // No specific state, but setup not done. (e.g. user typed something random before clicking button)
            await replyInitialSetupMessages(replyToken, accessToken);
        }
        return;
    }

    // Default reject for other event types during setup
    await replyMessage(replyToken, "まずは初期設定を完了させてください。\n利用方法を選択するか、指示に従ってください。", accessToken);
}

/**
 * 連携タイプを判定するヘルパー関数
 */
async function determineIntegrationType(db: D1Database, userId: string): Promise<IntegrationType> {
    const hasPubKey = await getPublicKey(db, userId);
    if (hasPubKey) {
        return 'obsidian';
    }

    const webhookConf = await getWebhookConfig(db, userId);
    if (webhookConf && webhookConf.webhook_url) {
        return 'webhook';
    }

    return 'none';
}

/**
 * モード選択とカスタムプロンプト入力を促す共通フロー
 */
async function askForModeSelection(env: Env, userId: string, replyToken: string, preMessages: any[] = []) {
    // 先に状態をセット
    await setTempState(env.LINE_AUDIO_KV, `prompt_setting_state:${userId}`, 'waiting', 300);

    const bubble = createModeSelectionBubble();
    const messages = [
        ...preMessages,
        { type: 'flex', altText: "モード選択", contents: bubble },
        { type: 'text', text: "✏️ オリジナルのプロンプトを設定するには、このメッセージに返信する形で新しいプロンプトを入力してください。" }
    ];
    await replyMessages(replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
}
