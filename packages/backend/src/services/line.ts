import { PromptMode } from '../core/prompts';

/**
 * LINE Messaging API サービス
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
                    text: "あなたの思考整理パートナー。",
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
                },
                {
                    type: "text",
                    text: "まずは利用モードを選択してください👇",
                    margin: "lg",
                    size: "sm",
                    align: "center",
                    color: "#000000",
                    weight: "bold"
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
                        label: "User ID を確認する",
                        text: "/id"
                    }
                },
                {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                        type: "uri",
                        label: "Obsidian連携ガイド",
                        uri: "https://example.com/guide"
                    }
                },
                {
                    type: "button",
                    style: "link",
                    height: "sm",
                    action: {
                        type: "message",
                        label: "ヘルプを表示",
                        text: "/help"
                    }
                }
            ],
            flex: 0
        }
    };

    const modeSelectionBubble = createModeSelectionBubble();

    const carousel = {
        type: "carousel",
        contents: [welcomeBubble, modeSelectionBubble]
    };

    await replyFlexMessage(replyToken, "LINE Audio Summarizerへようこそ！利用モードを選択してください。", carousel, accessToken);
}

function createModeSelectionBubble() {
    return {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: "モード選択",
                    weight: "bold",
                    size: "xl"
                },
                {
                    type: "text",
                    text: "AIの要約スタイルを選択してください。",
                    margin: "md",
                    size: "sm",
                    wrap: true
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
                    style: "secondary",
                    height: "sm",
                    action: {
                        type: "postback",
                        label: "の日記 (Diary)",
                        data: "action=set_mode&mode=diary",
                        displayText: "日記モードに設定"
                    }
                },
                {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                        type: "postback",
                        label: "ToDoリスト (ToDo)",
                        data: "action=set_mode&mode=todo",
                        displayText: "ToDoモードに設定"
                    }
                },
                {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                        type: "postback",
                        label: "メモ書き (Memo)",
                        data: "action=set_mode&mode=memo",
                        displayText: "メモモードに設定"
                    }
                },
                {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    action: {
                        type: "postback",
                        label: "壁打ち (Brainstorm)",
                        data: "action=set_mode&mode=brainstorm",
                        displayText: "壁打ちモードに設定"
                    }
                }
            ]
        }
    };
}

export async function replyPromptModeSelection(replyToken: string, accessToken: string): Promise<void> {
    const bubble = createModeSelectionBubble();
    await replyFlexMessage(replyToken, "モード選択", bubble, accessToken);
}

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
