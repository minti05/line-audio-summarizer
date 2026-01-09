/**
 * LINE Messaging API Service
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

export async function replyMessage(replyToken: string, text: string, accessToken: string): Promise<void> {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: [
                {
                    type: 'text',
                    text: text
                }
            ]
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to reply message: ${response.status} ${response.statusText} - ${errorBody}`);
    }
}

export async function replyFlexMessage(replyToken: string, altText: string, contents: any, accessToken: string): Promise<void> {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: [
                {
                    type: 'flex',
                    altText: altText,
                    contents: contents
                }
            ]
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to reply flex message: ${response.status} ${response.statusText} - ${errorBody}`);
    }
}

export async function replyWelcomeMessage(replyToken: string, accessToken: string): Promise<void> {
    const welcomeBubble = {
        type: "bubble",
        hero: {
            type: "image",
            url: "https://developers.line.biz/assets/images/services/bot-designer-icon.png", // Placeholder
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover",
        },
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: "LINE Audio Summarizer",
                    weight: "bold",
                    size: "xl"
                },
                {
                    type: "text",
                    text: "あなたの思考整理パートナーへようこそ！",
                    margin: "md",
                    size: "md",
                    wrap: true
                },
                {
                    type: "separator",
                    margin: "md"
                },
                {
                    type: "text",
                    text: "ボイスメッセージを送ると、AIが要約して Obsidian に保存します。",
                    margin: "md",
                    size: "sm",
                    wrap: true,
                    color: "#666666"
                }
            ]
        },
        footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
                {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    action: {
                        type: "message",
                        label: "自分のIDを確認 (/id)",
                        text: "/id"
                    }
                },
                {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                        type: "message",
                        label: "ヘルプ (/help)",
                        text: "/help"
                    }
                }
            ],
            flex: 0
        }
    };
    await replyFlexMessage(replyToken, "LINE Audio Summarizerへようこそ！", welcomeBubble, accessToken);
}
