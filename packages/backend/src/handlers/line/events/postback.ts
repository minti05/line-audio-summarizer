import { Env } from '../../../types/env';
import { replyMessage, replyFlexMessage } from '../../../clients/line';
import { getTempState } from '../../../utils/kv';
import { getUserConfig, upsertUserConfig, getPublicKey } from '../../../services/database/user'; // Note: getTicket might not exist, checking imports. Using addToInbox directly in save logic.
import { addToInbox } from '../../../services/database/inbox';
import { getWebhookConfig } from '../../../services/database/webhook-config';
import { encryptWithPublicKey } from '../../../core/crypto';
import { sendToWebhook } from '../../../services/integration/outgoing';
import { PromptMode, PROMPT_MODE_DETAILS } from '../../../core/prompts';
import { createSetupCompleteBubble } from '../../../ui/flex';
import { COMMON_MESSAGES } from '../../../constants/messages/common';
import { ERROR_MESSAGES } from '../../../constants/messages/error';
import { HELP_MESSAGES } from '../../../constants/messages/help';

/**
 * Postbackイベントハンドラ
 * ボタンアクションに応じた処理を実行します。
 */
export async function handlePostbackEvent(event: any, env: Env): Promise<void> {
    const replyToken = event.replyToken;
    const userId = event.source.userId;
    const params = new URLSearchParams(event.postback.data);
    const action = params.get('action');

    // 保存アクション
    if (action === 'save') {
        const sessionId = params.get('session_id');
        if (!sessionId) return;

        const summary = await getTempState<string>(env.LINE_AUDIO_KV, `session:${sessionId}`);
        if (!summary) {
            await replyMessage(replyToken, ERROR_MESSAGES.SESSION_EXPIRED, env.LINE_CHANNEL_ACCESS_TOKEN);
            return;
        }

        await saveToInbox(env, userId, summary, replyToken);
        // セッション削除
        await env.LINE_AUDIO_KV.delete(`session:${sessionId}`);
        return;
    }

    // 破棄アクション
    if (action === 'discard') {
        const sessionId = params.get('session_id');
        if (sessionId) {
            await env.LINE_AUDIO_KV.delete(`session:${sessionId}`);
        }
        await replyMessage(replyToken, COMMON_MESSAGES.DISCARDED, env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
    }

    // モード設定アクション
    if (action === 'set_mode') {
        const promptStateKey = `prompt_setting_state:${userId}`;
        const isSettingPrompt = await getTempState(env.LINE_AUDIO_KV, promptStateKey);

        if (!isSettingPrompt) {
            await replyMessage(replyToken, ERROR_MESSAGES.MODE_SELECTION_EXPIRED, env.LINE_CHANNEL_ACCESS_TOKEN);
            return;
        }

        const mode = params.get('mode') as PromptMode;
        // 有効なモードか確認
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
            await replyFlexMessage(replyToken, HELP_MESSAGES.SETUP_COMPLETE_TITLE, bubble, env.LINE_CHANNEL_ACCESS_TOKEN);
        }
    }
}

/**
 * 要約をInbox（DB/Webhook）に保存するヘルパー関数
 */
async function saveToInbox(env: Env, userId: string, summary: string, replyToken: string) {
    // 1. Webhook送信 (設定されていれば)
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
    
    // 2. Obsidian Inbox保存 (公開鍵があれば)
    const publicKeyPem = await getPublicKey(env.DB, userId);
    
    if (publicKeyPem) {
        const encrypted = await encryptWithPublicKey(summary, publicKeyPem);
        await addToInbox(env.DB, userId, encrypted.encryptedData, encrypted.iv, encrypted.encryptedKey);
        await replyMessage(replyToken, COMMON_MESSAGES.SAVED_TO_INBOX, env.LINE_CHANNEL_ACCESS_TOKEN);
    } else {
        // Obsidianキーがなく、Webhookも送られていない場合は警告
        // ただしWebhookのみ利用のケースもあるため、WebhookConfig取得済みかどうかで分岐判定済みか考慮が必要
        // 現状は「公開鍵がない＝Obsidian連携していない」場合のメッセージを表示
        // もしWebhookのみユーザーならこのメッセージは不要かもしれないが、
        // 「保存」ボタンを押した文脈では「どこかに保存された」フィードバックが必要。
        // Webhook送信成功ならそれでOK、失敗ならエラーなど。
        // ここではシンプルにObsidian連携がない場合のみメッセージを出す（既存ロジック踏襲）
        // 既存ロジックでは公開鍵がないとエラーを出していた。
        
        // 修正: Webhookがあればエラーにしない
        const webhookConfig = await getWebhookConfig(env.DB, userId);
        if (!webhookConfig?.webhook_url) { 
             await replyMessage(replyToken, ERROR_MESSAGES.PUBLIC_KEY_NOT_FOUND, env.LINE_CHANNEL_ACCESS_TOKEN);
        } else {
             // Webhookのみの場合の成功メッセージ
             await replyMessage(replyToken, "Webhookへ送信しました。", env.LINE_CHANNEL_ACCESS_TOKEN);
        }
    }
}
