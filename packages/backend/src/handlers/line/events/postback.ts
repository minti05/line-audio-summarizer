import { Env } from '../../../types/env';
import { Database } from '../../../db';
import { replyMessage, replyFlexMessage } from '../../../clients/line';
import { getTempState } from '../../../utils/kv';
import { getUserConfig, upsertUserConfig, getPublicKey } from '../../../repositories/user';
import { addToInbox } from '../../../repositories/inbox';
import { getWebhookConfig } from '../../../repositories/webhook';
import { encryptWithPublicKey } from '../../../core/crypto';
import { sendToWebhook } from '../../../services/integration/outgoing';
import { PromptMode, PROMPT_MODE_DETAILS } from '../../../core/prompts';
import { createSetupCompleteBubble } from '../../../constants/messages/flex';
import { COMMON_MESSAGES } from '../../../constants/messages/common';
import { ERROR_MESSAGES } from '../../../constants/messages/error';
import { HELP_MESSAGES } from '../../../constants/messages/help';

/**
 * Postbackイベントハンドラ
 * ボタンアクションに応じた処理を実行します。
 */
export async function handlePostbackEvent(event: any, env: Env, db: Database): Promise<void> {
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

        await saveToInbox(env, db, userId, summary, replyToken);
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
            const userConfig = await getUserConfig(db, userId);
            await upsertUserConfig(db, {
                lineUserId: userId,
                confirmMode: userConfig?.confirmMode ?? 1,
                promptMode: mode,
                customPrompt: userConfig?.customPrompt || null
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
async function saveToInbox(env: Env, db: Database, userId: string, summary: string, replyToken: string) {
    // 1. Webhook送信 (設定されていれば)
    try {
        const webhookConfig = await getWebhookConfig(db, userId);
        if (webhookConfig && webhookConfig.webhookUrl) {
            await sendToWebhook(webhookConfig.webhookUrl, {
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
    const publicKeyPem = await getPublicKey(db, userId);
    
    if (publicKeyPem) {
        const encrypted = await encryptWithPublicKey(summary, publicKeyPem);
        await addToInbox(db, {
            lineUserId: userId,
            encryptedData: encrypted.encryptedData,
            iv: encrypted.iv,
            encryptedKey: encrypted.encryptedKey
        });
        await replyMessage(replyToken, COMMON_MESSAGES.SAVED_TO_INBOX, env.LINE_CHANNEL_ACCESS_TOKEN);
    } else {
        // 修正: Webhookがあればエラーにしない
        const webhookConfig = await getWebhookConfig(db, userId);
        if (!webhookConfig?.webhookUrl) { 
             await replyMessage(replyToken, ERROR_MESSAGES.PUBLIC_KEY_NOT_FOUND, env.LINE_CHANNEL_ACCESS_TOKEN);
        } else {
             // Webhookのみの場合の成功メッセージ
             await replyMessage(replyToken, "Webhookへ送信しました。", env.LINE_CHANNEL_ACCESS_TOKEN);
        }
    }
}
