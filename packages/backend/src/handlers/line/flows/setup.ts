import { Env } from '../../../types/env';
import { replyMessages, replyMessage } from '../../../clients/line';
import { setTempState } from '../../../utils/kv';
import { getPublicKey, upsertUserConfig } from '../../../services/database/user';
import { upsertWebhookConfig } from '../../../services/database/webhook-config';
import { PromptMode } from '../../../core/prompts';
import { createInitialSetupBubble, createModeSelectionBubble, IntegrationType } from '../../../ui/flex';
import { getWebhookConfig } from '../../../services/database/webhook-config';
import { HELP_MESSAGES } from '../../../constants/messages/help';
import { ERROR_MESSAGES } from '../../../constants/messages/error';
import { COMMON_MESSAGES } from '../../../constants/messages/common';

/**
 * セットアップ中のユーザーインタラクションを処理します。
 * @param event LINEイベントオブジェクト
 * @param env 環境変数
 * @param userId ユーザーID
 * @param currentState 現在のセットアップ状態
 */
export async function handleSetupMode(event: any, env: Env, userId: string, currentState: any): Promise<void> {
    const replyToken = event.replyToken;
    const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN;

    // ボタン（Postback）アクションの処理
    if (event.type === 'postback') {
        const params = new URLSearchParams(event.postback.data);
        const action = params.get('action');

        if (action === 'setup_obsidian') {
            await replyMessages(replyToken, HELP_MESSAGES.SETUP_OBSIDIAN_INSTRUCTION(userId), accessToken);
            await setTempState(env.LINE_AUDIO_KV, `setup_state:${userId}`, 'waiting_for_obsidian', 86400); // 1日待機
        } else if (action === 'setup_webhook') {
            await replyMessages(replyToken, HELP_MESSAGES.SETUP_WEBHOOK_INSTRUCTION, accessToken);
            await setTempState(env.LINE_AUDIO_KV, `setup_state:${userId}`, 'waiting_for_webhook', 3600); // 1時間待機
        } else if (action === 'setup_nothing') {
            await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);

            // 既存の設定をクリア（連携なしを選択したため）
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
                { type: 'text', text: HELP_MESSAGES.SETUP_NOTHING_CONFIRMATION }
            ]);
        } else {
            // 不明なアクションの場合は初期セットアップメッセージを再送
            await replyInitialSetupMessages(replyToken, accessToken);
        }
        return;
    }

    // テキストメッセージによる入力処理
    if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();

        // キャンセル処理
        if (['キャンセル', 'cancel', '戻る', 'やめる'].includes(text)) {
            await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);
            await replyMessage(replyToken, COMMON_MESSAGES.CANCELLED, accessToken);
            return;
        }

        if (currentState === 'waiting_for_obsidian') {
            const hasKey = await getPublicKey(env.DB, userId);
            if (hasKey) {
                await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);
                await askForModeSelection(env, userId, replyToken, [
                    { type: 'text', text: HELP_MESSAGES.OBSIDIAN_LINKED }
                ]);
            } else {
                await replyMessage(replyToken, HELP_MESSAGES.SETUP_NOT_CONFIRMED, accessToken);
            }
        } else if (currentState === 'waiting_for_webhook') {
            if (text.startsWith('https://')) {
                await upsertWebhookConfig(env.DB, { line_user_id: userId, webhook_url: text, secret_token: null, config: null });
                await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);
                await askForModeSelection(env, userId, replyToken, [
                    { type: 'text', text: HELP_MESSAGES.WEBHOOK_LINKED }
                ]);
            } else {
                await replyMessage(replyToken, ERROR_MESSAGES.INVALID_WEBHOOK_URL, accessToken);
            }
        } else {
            // 特定の状態がないがセットアップ未完了の場合
            await replyInitialSetupMessages(replyToken, accessToken);
        }
        return;
    }

    // その他のイベントタイプの場合は案内を送信
    await replyMessage(replyToken, ERROR_MESSAGES.SETUP_REQUIRED, accessToken);
}


/**
 * モード選択とカスタムプロンプト入力を促す共通フローへの誘導
 */
export async function askForModeSelection(env: Env, userId: string, replyToken: string, preMessages: any[] = []) {
    await setTempState(env.LINE_AUDIO_KV, `prompt_setting_state:${userId}`, 'waiting', 300);

    const bubble = createModeSelectionBubble();
    const messages = [
        ...preMessages,
        { type: 'flex', altText: HELP_MESSAGES.MODE_SELECTION_TITLE, contents: bubble },
        { type: 'text', text: HELP_MESSAGES.CUSTOM_PROMPT_INSTRUCTION }
    ];
    await replyMessages(replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
}

/**
 * 初期セットアップメッセージを送信するヘルパー
 */
export async function replyInitialSetupMessages(replyToken: string, accessToken: string): Promise<void> {
    const textMessage = {
        type: "text",
        text: HELP_MESSAGES.INITIAL_SETUP_TEXT
    };

    const flexMessage = {
        type: "flex",
        altText: "初期設定: 利用方法を選択してください",
        contents: createInitialSetupBubble()
    };

    await replyMessages(replyToken, [textMessage, flexMessage], accessToken);
}

/**
 * 連携タイプを判定するヘルパー関数
 */
export async function determineIntegrationType(db: D1Database, userId: string): Promise<IntegrationType> {
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
