export type IntegrationType = 'obsidian' | 'webhook' | 'none';

export function createConfirmationBubble(summary: string, sessionId: string, label: string, integrationType: IntegrationType): any {
    const footerButtons = [];

    if (integrationType === 'obsidian') {
        footerButtons.push(
            {
                type: "button",
                style: "primary",
                height: "sm",
                action: {
                    type: "postback",
                    label: "保存", // Obsidianの場合
                    data: `action=save&session_id=${sessionId}`,
                    displayText: "保存"
                }
            },
            {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                    type: "postback",
                    label: "破棄",
                    data: `action=discard&session_id=${sessionId}`,
                    displayText: "破棄"
                }
            }
        );
    } else if (integrationType === 'webhook') {
        footerButtons.push(
            {
                type: "button",
                style: "primary",
                height: "sm",
                action: {
                    type: "postback",
                    label: "投稿", // Webhookの場合
                    data: `action=save&session_id=${sessionId}`,
                    displayText: "投稿"
                }
            },
            {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                    type: "postback",
                    label: "破棄",
                    data: `action=discard&session_id=${sessionId}`,
                    displayText: "破棄"
                }
            }
        );
    }
    // integrationType === 'none' の場合はボタンを追加しない

    const bubble: any = {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: `${label} を作成しました`,
                    weight: "bold",
                    size: "xl"
                },
                {
                    type: "separator",
                    margin: "md"
                },
                {
                    type: "text",
                    text: summary.substring(0, 300) + (summary.length > 300 ? "..." : ""),
                    wrap: true,
                    margin: "md",
                    size: "sm"
                }
            ]
        }
    };

    if (footerButtons.length > 0) {
        bubble.footer = {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: footerButtons
        };
    }

    return bubble;
}

export function createSetupCompleteBubble(title: string, description: string): any {
    return {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: "設定が完了しました ✨",
                    weight: "bold",
                    size: "sm",
                    color: "#1DB446"
                },
                {
                    type: "text",
                    text: title,
                    weight: "bold",
                    size: "xl",
                    margin: "sm",
                    wrap: true,
                    color: "#333333"
                },
                {
                    type: "text",
                    text: description,
                    size: "sm",
                    color: "#666666",
                    margin: "md",
                    wrap: true
                },
                {
                    type: "separator",
                    margin: "xl"
                },
                {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "text",
                            text: "🎙️ ボイスメッセージを送る",
                            size: "md",
                            weight: "bold",
                            align: "center",
                            color: "#333333"
                        },
                        {
                            type: "text",
                            text: "あなたの思考を声に出してください。\nAIが要約して記録・送信します。",
                            size: "xs",
                            color: "#888888",
                            align: "center",
                            margin: "sm",
                            wrap: true,
                            lineSpacing: "4px"
                        }
                    ],
                    margin: "xl",
                    backgroundColor: "#F7F9F7",
                    cornerRadius: "md",
                    paddingAll: "lg"
                }
            ],
            paddingAll: "xl"
        }
    };
}
