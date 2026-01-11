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

export async function pushMessage(userId: string, text: string, accessToken: string): Promise<void> {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            to: userId,
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
        console.warn(`Failed to push message: ${response.status} ${response.statusText} - ${errorBody}`);
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

export async function replyInitialSetupMessages(replyToken: string, accessToken: string): Promise<void> {
    const textMessage = {
        type: "text",
        text: "友達追加ありがとうございます！\n\nこのLINE Audio Summarizerでできることは大きく2つです。\n\n1️⃣ Obsidian連携\n音声要約をクラウド経由で同期し、Obsidianに自動保存します。\n\n2️⃣ Webhook連携\n要約結果をWebhookで送信し、SlackやXなど、お好きなサービスと連携できます。\n\n👇 以下のボタンから、利用方法を選択してください。"
    };

    const flexMessage = {
        type: "flex",
        altText: "初期設定: 利用方法を選択してください",
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "利用方法の選択",
                        weight: "bold",
                        size: "xl",
                        color: "#111111"
                    },
                    {
                        type: "text",
                        text: "どちらの方法で利用しますか？\n（後から変更可能です）",
                        margin: "md",
                        size: "sm",
                        color: "#666666",
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
                        style: "primary",
                        height: "sm",
                        color: "#7E57C2", // Deep Purple
                        action: {
                            type: "postback",
                            label: "Obsidianに接続する",
                            data: "action=setup_obsidian",
                            displayText: "Obsidianに接続する"
                        }
                    },
                    {
                        type: "button",
                        style: "primary", // Changed to primary for better visibility
                        height: "sm",
                        color: "#26A69A", // Teal
                        action: {
                            type: "postback",
                            label: "Webhookとして利用する",
                            data: "action=setup_webhook",
                            displayText: "Webhookとして利用する"
                        }
                    }
                ]
            }
        }
    };

    await replyMessages(replyToken, [textMessage, flexMessage], accessToken);
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

export function createModeSelectionBubble() {
    const modes = [
        {
            label: "気づき・メモ",
            sub: "Memo",
            desc: "ふとしたアイデアを忘れないうちに記録。",
            mode: "memo",
            color: "#E0F7FA", // Light Cyan
            icon: "📝"
        },
        {
            label: "日記モード",
            sub: "Diary",
            desc: "1日の振り返りを感情とともに整理。",
            mode: "diary",
            color: "#F3E5F5", // Light Purple
            icon: "📔"
        },
        {
            label: "TODO抽出",
            sub: "ToDo",
            desc: "すべきことを明確にリスト化。",
            mode: "todo",
            color: "#E8F5E9", // Light Green
            icon: "✅"
        },
        {
            label: "アイデア壁打ち",
            sub: "Brainstorm",
            desc: "思考を構造化し、深めるための「問い」を提案。",
            mode: "brainstorm",
            color: "#FFF3E0", // Light Orange
            icon: "💡"
        }
    ];

    const modeContents = modes.map((m) => ({
        type: "box",
        layout: "vertical",
        contents: [
            {
                type: "box",
                layout: "horizontal",
                contents: [
                    {
                        type: "text",
                        text: m.icon,
                        size: "lg",
                        flex: 0,
                        margin: "none"
                    },
                    {
                        type: "text",
                        text: m.label,
                        weight: "bold",
                        size: "md",
                        flex: 1,
                        margin: "sm",
                        color: "#333333"
                    },
                    {
                        type: "text",
                        text: m.sub,
                        size: "xs",
                        color: "#999999",
                        align: "end",
                        gravity: "center"
                    }
                ],
                alignItems: "center"
            },
            {
                type: "text",
                text: m.desc,
                size: "xs",
                color: "#666666",
                wrap: true,
                margin: "sm"
            }
        ],
        paddingAll: "lg",
        backgroundColor: m.color,
        cornerRadius: "md",
        action: {
            type: "postback",
            label: m.label,
            data: `action=set_mode&mode=${m.mode}`,
            displayText: `${m.label}に設定`
        },
        margin: "md"
    }));

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
                    size: "xl",
                    color: "#111111"
                },
                {
                    type: "text",
                    text: "AIの要約スタイルを選択してください。",
                    margin: "md",
                    size: "sm",
                    color: "#666666",
                    wrap: true
                },
                {
                    type: "separator",
                    margin: "lg"
                },
                {
                    type: "box",
                    layout: "vertical",
                    contents: modeContents,
                    margin: "lg"
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
