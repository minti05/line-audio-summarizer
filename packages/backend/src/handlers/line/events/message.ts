import { Env } from '../../../types/env';
import { Database } from '../../../db';
import { handleCommandEvent } from './command';
import { handleAudioEvent } from './audio';

/**
 * メッセージイベントハンドラ
 * メッセージの種類（テキスト/音声）に応じて処理を振り分けます。
 */
export async function handleMessageEvent(event: any, env: Env, db: Database, userId: string): Promise<void> {
    const messageType = event.message.type;

    if (messageType === 'text') {
        const text = event.message.text.trim();
        // コマンド（/で始まるもの）または特定のキーワードはコマンドハンドラへ
        // handleCommandEvent内で「コマンド以外」の処理（ステータス表示）も行っている設計
        await handleCommandEvent(event, env, db, userId, text);
    } else if (messageType === 'audio') {
        await handleAudioEvent(event, env, db, userId);
    } 
    // 他のメッセージタイプは現状無視（必要に応じて追加）
}
