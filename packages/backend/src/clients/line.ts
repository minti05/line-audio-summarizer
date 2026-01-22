/**
 * LINE Messaging API クライアント
 * 
 * HTTPリクエストの送信のみを担当し、ビジネスロジックは含みません。
 */

/**
 * メッセージ ID からコンテンツ（画像、音声、動画など）のバイナリデータを取得します。
 * @param messageId メッセージID
 * @param accessToken LINEチャネルアクセストークン
 * @returns ArrayBuffer 形式のコンテンツデータ
 */
export async function getContent(messageId: string, accessToken: string): Promise<ArrayBuffer> {
    const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
}

/**
 * 応答メッセージを送信します。
 * @param replyToken 応答トークン
 * @param messages 送信するメッセージオブジェクトの配列
 * @param accessToken LINEチャネルアクセストークン
 */
export async function replyMessages(replyToken: string, messages: any[], accessToken: string): Promise<void> {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: messages
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to reply messages: ${response.status} ${response.statusText} - ${errorBody}`);
    }
}

/**
 * 単一のテキストメッセージを応答送信するショートカット関数です。
 * @param replyToken 応答トークン
 * @param text 送信するテキスト
 * @param accessToken LINEチャネルアクセストークン
 */
export async function replyMessage(replyToken: string, text: string, accessToken: string): Promise<void> {
    await replyMessages(replyToken, [{ type: 'text', text: text }], accessToken);
}

/**
 * Flex Message を応答送信するショートカット関数です。
 * @param replyToken 応答トークン
 * @param altText 代替テキスト
 * @param contents Flex Message の contents オブジェクト
 * @param accessToken LINEチャネルアクセストークン
 */
export async function replyFlexMessage(replyToken: string, altText: string, contents: any, accessToken: string): Promise<void> {
    await replyMessages(replyToken, [{ type: 'flex', altText: altText, contents: contents }], accessToken);
}

/**
 * プッシュメッセージを送信します。
 * @param userId 送信先ユーザーID
 * @param messages 送信するメッセージオブジェクトの配列
 * @param accessToken LINEチャネルアクセストークン
 */
export async function pushMessages(userId: string, messages: any[], accessToken: string): Promise<void> {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            to: userId,
            messages: messages
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.warn(`Failed to push message: ${response.status} ${response.statusText} - ${errorBody}`);
    }
}

/**
 * 単一のテキストメッセージをプッシュ送信するショートカット関数です。
 * @param userId 送信先ユーザーID
 * @param text 送信するテキスト
 * @param accessToken LINEチャネルアクセストークン
 */
export async function pushMessage(userId: string, text: string, accessToken: string): Promise<void> {
    await pushMessages(userId, [{ type: 'text', text: text }], accessToken);
}

/**
 * ローディングアニメーションを表示します。
 * @param chatId チャットID (ユーザーID)
 * @param accessToken LINEチャネルアクセストークン
 * @param loadingSeconds 表示する秒数（デフォルト20秒）
 */
export async function startLoadingAnimation(chatId: string, accessToken: string, loadingSeconds: number = 20): Promise<void> {
    try {
        const response = await fetch('https://api.line.me/v2/bot/chat/loading/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                chatId: chatId,
                loadingSeconds: loadingSeconds
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.warn(`Failed to start loading animation: ${response.status} ${response.statusText} - ${errorBody}`);
        }
    } catch (e) {
        console.warn('Error starting loading animation:', e);
    }
}
