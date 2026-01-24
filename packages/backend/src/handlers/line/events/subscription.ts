import { Env } from '../../../types/env';
import { replyFlexMessage } from '../../../clients/line';
import { Database } from '../../../db';
import { deleteUserConfig, deletePublicKey } from '../../../repositories/user';
import { deleteWebhookConfig } from '../../../repositories/webhook';
import { createWelcomeBubble, createModeSelectionBubble, createInitialSetupBubble } from '../../../constants/messages/flex';
import { HELP_MESSAGES } from '../../../constants/messages/help';

/**
 * 友だち追加（Follow）イベントハンドラ
 * ウェルカムメッセージとモード選択画面を表示します。
 */
export async function handleFollowEvent(event: any, env: Env): Promise<void> {
    const replyToken = event.replyToken;
    const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN;

    const welcomeBubble = createWelcomeBubble();
    const modeSelectionBubble = createModeSelectionBubble();

    // カルーセル形式で表示
    const carousel = {
        type: "carousel",
        contents: [welcomeBubble, modeSelectionBubble]
    };

    await replyFlexMessage(replyToken, HELP_MESSAGES.WELCOME_TITLE, carousel, accessToken);
}

/**
 * ブロック（Unfollow）イベントハンドラ
 * ユーザーに関連するデータを削除（クリーンアップ）します。
 */
export async function handleUnfollowEvent(event: any, env: Env, db: Database): Promise<void> {
    const userId = event.source.userId;
    console.log(`User ${userId} unfollowed. Cleaning up data.`);

    // KVの状態削除
    await env.LINE_AUDIO_KV.delete(`setup_state:${userId}`);
    await env.LINE_AUDIO_KV.delete(`prompt_setting_state:${userId}`);

    // DBのデータ削除
    await deletePublicKey(db, userId);
    await deleteWebhookConfig(db, userId);
    await deleteUserConfig(db, userId);
}
