import { Env } from '../../../types/env';
import { Database } from '../../../db';
import { getContent, startLoadingAnimation, replyFlexMessage, replyMessage } from '../../../clients/line';
import { generateSummary } from '../../../clients/gemini';
import { getSystemPrompt, PromptMode, PROMPT_MODE_DETAILS } from '../../../core/prompts';
import { getUserConfig, getPublicKey } from '../../../repositories/user';
import { addToInbox } from '../../../repositories/inbox';
import { getWebhookConfig } from '../../../repositories/webhook';
import { encryptWithPublicKey } from '../../../core/crypto';
import { setTempState } from '../../../utils/kv';
import { sendToWebhook } from '../../../services/integration/outgoing';
import { createConfirmationBubble, IntegrationType } from '../../../constants/messages/flex';
import { COMMON_MESSAGES } from '../../../constants/messages/common';
import { HELP_MESSAGES } from '../../../constants/messages/help';
import { ERROR_MESSAGES } from '../../../constants/messages/error';

/**
 * 音声メッセージイベントハンドラ
 * 音声を取得し、要約を生成して結果を返します。
 */
export async function handleAudioEvent(event: any, env: Env, db: Database, userId: string): Promise<void> {
    const messageId = event.message.id;
    const replyToken = event.replyToken;
    const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN;

    // ユーザー設定の確認
    const userConfig = await getUserConfig(db, userId);
    const confirmMode = userConfig ? userConfig.confirmMode : 1; // デフォルト ON

    // プロンプトの解決
    const promptMode = (userConfig?.promptMode as PromptMode) || PromptMode.Memo;
    const systemPrompt = getSystemPrompt(promptMode, userConfig?.customPrompt ?? undefined);

    // 0. ローディング表示
    await startLoadingAnimation(userId, accessToken);

    // 1. 音声コンテンツの取得
    const audioBuffer = await getContent(messageId, accessToken);

    // 2. 要約の生成
    const summary = await generateSummary(audioBuffer, 'audio/m4a', env.GEMINI_API_KEY, systemPrompt);

    if (confirmMode === 0) {
        // 自動保存モード
        await saveToInboxDirectly(env, db, userId, summary, replyToken);
    } else {
        // 投稿前確認モード
        const sessionId = crypto.randomUUID();
        const label = promptMode === PromptMode.Custom ? 'Custom' : PROMPT_MODE_DETAILS[promptMode as Exclude<PromptMode, PromptMode.Custom>].label;
        
        // セッションに要約を保存（10分有効）
        await setTempState(env.LINE_AUDIO_KV, `session:${sessionId}`, summary, 600);

        // 統合タイプの判定（ObsidianかWebhookか）
        const integrationType = await determineIntegrationTypeForUI(db, userId);

        const bubble = createConfirmationBubble(summary, sessionId, label, integrationType);
        await replyFlexMessage(replyToken, HELP_MESSAGES.CONFIRMATION_TITLE, bubble, accessToken);
    }
}

/**
 * 自動保存モード時の直接保存処理
 */
async function saveToInboxDirectly(env: Env, db: Database, userId: string, summary: string, replyToken: string) {
     // 1. Webhook送信
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

    // 2. Obsidian Inbox保存
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
        // Webhookのみの場合
        const webhookConfig = await getWebhookConfig(db, userId);
        if (webhookConfig?.webhookUrl) {
            await replyMessage(replyToken, "Webhookへ送信しました。", env.LINE_CHANNEL_ACCESS_TOKEN);
        } else {
             await replyMessage(replyToken, ERROR_MESSAGES.PUBLIC_KEY_NOT_FOUND, env.LINE_CHANNEL_ACCESS_TOKEN);
        }
    }
}

/**
 * UI表示用に連携タイプを判定するヘルパー
 */
async function determineIntegrationTypeForUI(db: Database, userId: string): Promise<IntegrationType> {
    const hasPubKey = await getPublicKey(db, userId);
    if (hasPubKey) {
        return 'obsidian';
    }

    const webhookConf = await getWebhookConfig(db, userId);
    if (webhookConf && webhookConf.webhookUrl) {
        return 'webhook';
    }

    return 'none';
}
