import { PromptMode, PROMPT_MODE_DETAILS } from '../../core/prompts';

export type IntegrationType = 'obsidian' | 'webhook' | 'none';

/**
 * モード選択バブルを作成します。
 * プロンプトモードの一覧を表示し、ユーザーに選択させます。
 */
export function createModeSelectionBubble(): any {
    const modeContents = Object.values(PROMPT_MODE_DETAILS).map((details) => {
        // Enumsのキーを逆引き
        const modeKey = Object.keys(PROMPT_MODE_DETAILS).find(key => PROMPT_MODE_DETAILS[key as Exclude<PromptMode, PromptMode.Custom>] === details) as PromptMode;

        return {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                        {
                            type: "text",
                            text: details.icon,
                            size: "lg",
                            flex: 0,
                            margin: "none"
                        },
                        {
                            type: "text",
                            text: details.label,
                            weight: "bold",
                            size: "md",
                            flex: 1,
                            margin: "sm",
                            color: "#333333"
                        },
                        {
                            type: "text",
                            text: details.sub,
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
                    text: details.desc,
                    size: "xs",
                    color: "#666666",
                    wrap: true,
                    margin: "sm"
                }
            ],
            paddingAll: "lg",
            backgroundColor: details.color,
            cornerRadius: "md",
            action: {
                type: "postback",
                label: details.label,
                data: `action=set_mode&mode=${modeKey}`,
                displayText: `${details.label}に設定`
            },
            margin: "md"
        };
    });

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

/**
 * 要約結果の確認用バブルを作成します。
 * 保存または破棄を選択するボタンが含まれます。
 */
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

/**
 * セットアップ完了バブルを作成します。
 */
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

/**
 * 初期セットアップ（利用方法選択）のFlex Messageを作成します。
 */
export function createInitialSetupBubble(): any {
    return {
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
                },
                {
                    type: "button",
                    style: "primary", // Changed to primary for better visibility
                    height: "sm",
                    color: "#444444", // Teal
                    action: {
                        type: "postback",
                        label: "設定せずに使用する",
                        data: "action=setup_nothing",
                        displayText: "設定せずに使用する"
                    }
                }
            ]
        }
    };
}

/**
 * 連携先変更のFlex Messageを作成します。
 */
export function createChangeTargetBubble(): any {
    return {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: "連携先の変更",
                    weight: "bold",
                    size: "xl",
                    color: "#111111"
                },
                {
                    type: "text",
                    text: "新しい連携先を選択してください。",
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
                    color: "#7E57C2",
                    action: {
                        type: "postback",
                        label: "Obsidianに接続",
                        data: "action=setup_obsidian",
                        displayText: "Obsidianに接続する"
                    }
                },
                {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    color: "#26A69A",
                    action: {
                        type: "postback",
                        label: "Webhookを利用",
                        data: "action=setup_webhook",
                        displayText: "Webhookとして利用する"
                    }
                },
                {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    color: "#444444",
                    action: {
                        type: "postback",
                        label: "設定せずに利用",
                        data: "action=setup_nothing",
                        displayText: "設定せずに使用する"
                    }
                }
            ]
        }
    };
}

/**
 * ウェルカムメッセージ（初期表示）のFlex Messageを作成します。
 */
export function createWelcomeBubble(): any {
    return {
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
}
