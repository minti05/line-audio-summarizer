import { Env } from '../types/env';
import { validateSignature } from '../core/security';
import { getContent, replyMessage, replyFlexMessage, replyWelcomeMessage } from '../services/line';
import { generateSummary } from '../services/gemini';
import { getPublicKey, addToInbox } from '../services/db';
import { encryptWithPublicKey } from '../services/crypto';
import { setTempState, getTempState } from '../services/kv';

export async function webhookHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('x-line-signature');
    if (!signature) {
        return new Response('Missing Signature', { status: 401 });
    }

    const body = await request.text();

    // Validate Signature
    const isValid = await validateSignature(body, env.LINE_CHANNEL_SECRET, signature);
    if (!isValid) {
        return new Response('Invalid Signature', { status: 403 });
    }

    try {
        const data = JSON.parse(body);
        const events = data.events;

        // Process events asynchronously
        ctx.waitUntil((async () => {
            await Promise.all(events.map(async (event: any) => {
                try {
                    const userId = event.source.userId;

                    // Handle Follow Event
                    if (event.type === 'follow') {
                        await replyWelcomeMessage(event.replyToken, env.LINE_CHANNEL_ACCESS_TOKEN);
                    }

                    // Handle Audio Message
                    else if (event.type === 'message' && event.message.type === 'audio') {
                        const messageId = event.message.id;
                        const replyToken = event.replyToken;

                        // 1. Get Audio Content
                        const audioBuffer = await getContent(messageId, env.LINE_CHANNEL_ACCESS_TOKEN);

                        // 2. Generate Summary with Gemini
                        const summary = await generateSummary(audioBuffer, 'audio/m4a', env.GEMINI_API_KEY);

                        // 3. Store Summary temporarily in KV (10 mins TTL)
                        const sessionId = crypto.randomUUID();
                        await setTempState(env.LINE_AUDIO_KV, `session:${sessionId}`, summary, 600);

                        // 4. Send Confirmation Flex Message
                        await sendConfirmationFlex(replyToken, summary, sessionId, env.LINE_CHANNEL_ACCESS_TOKEN);

                    }
                    // Handle Postback (Confirm Save)
                    else if (event.type === 'postback') {
                        const replyToken = event.replyToken;
                        const params = new URLSearchParams(event.postback.data);
                        const action = params.get('action');
                        const sessionId = params.get('session_id');

                        if (action === 'save' && sessionId) {
                            const summary = await getTempState<string>(env.LINE_AUDIO_KV, `session:${sessionId}`);
                            if (!summary) {
                                await replyMessage(replyToken, 'Session expired or invalid.', env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            // Encrypt and Save
                            const publicKeyPem = await getPublicKey(env.DB, userId);
                            if (!publicKeyPem) {
                                await replyMessage(replyToken, '公開鍵が見つかりません。Obsidianからデバイス登録を行ってください。', env.LINE_CHANNEL_ACCESS_TOKEN);
                                return;
                            }

                            const encrypted = await encryptWithPublicKey(summary, publicKeyPem);
                            await addToInbox(env.DB, userId, encrypted.encryptedData, encrypted.iv, encrypted.encryptedKey);

                            await replyMessage(replyToken, 'Inboxに保存しました (暗号化済み)。Obsidianを開いて同期してください。', env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                        else if (action === 'discard') {
                            await replyMessage(replyToken, '破棄しました。', env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                    }
                    // Handle Text Commands
                    else if (event.type === 'message' && event.message.type === 'text') {
                        const text = event.message.text.trim();
                        if (text === '/id') {
                            await replyMessage(event.replyToken, `あなたの LINE User ID はこちらです:\n${userId}\n\nこのIDを Obsidian の設定画面に入力してください。`, env.LINE_CHANNEL_ACCESS_TOKEN);
                        } else if (text === '/help' || text === 'ヘルプ') {
                            const helpText = "【コマンド一覧】\n/id : 自分のUser IDを確認\n/help : このヘルプを表示\n\n音声メッセージを送ると、AIが要約して確認メッセージを返します。「保存」を押すとObsidianに同期されます。";
                            await replyMessage(event.replyToken, helpText, env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                    }
                } catch (err: any) {
                    console.error('Error processing event:', err);
                    if (event.replyToken) {
                        try {
                            await replyMessage(event.replyToken, `Error: ${err.message}`, env.LINE_CHANNEL_ACCESS_TOKEN);
                        } catch (replyErr) {
                            console.error('Failed to send error reply:', replyErr);
                        }
                    }
                }
            }));
        })());

        return new Response('OK', { status: 200 });

    } catch (e) {
        console.error('Error processing webhook:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
}

async function sendConfirmationFlex(replyToken: string, summary: string, sessionId: string, accessToken: string) {
    const bubble = {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: "要約が作成されました",
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
        },
        footer: {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
                {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    action: {
                        type: "postback",
                        label: "保存 (暗号化)",
                        data: `action=save&session_id=${sessionId}`,
                        displayText: "保存 (暗号化)"
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
            ]
        }
    };
    await replyFlexMessage(replyToken, "要約が作成されました", bubble, accessToken);
}
