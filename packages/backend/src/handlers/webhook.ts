import { Env } from '../types/env';
import { validateSignature } from '../core/security';
import { getContent, replyMessage } from '../services/line';
import { generateSummary } from '../services/gemini';

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
    // Validation must be fast.
    const isValid = await validateSignature(body, env.LINE_CHANNEL_SECRET, signature);
    if (!isValid) {
        return new Response('Invalid Signature', { status: 403 });
    }

    try {
        const data = JSON.parse(body);
        const events = data.events;

        // Process events asynchronously
        ctx.waitUntil((async () => {
            const results = await Promise.all(events.map(async (event: any) => {
                try {
                    if (event.type === 'message' && event.message.type === 'audio') {
                        const messageId = event.message.id;
                        const replyToken = event.replyToken;

                        // 1. Get Audio Content
                        const audioBuffer = await getContent(messageId, env.LINE_CHANNEL_ACCESS_TOKEN);

                        // 2. Generate Summary with Gemini
                        const summary = await generateSummary(audioBuffer, 'audio/m4a', env.GEMINI_API_KEY);

                        // 3. Reply with Summary
                        await replyMessage(replyToken, summary, env.LINE_CHANNEL_ACCESS_TOKEN);

                    } else if (event.type === 'message' && event.message.type === 'text') {
                        // Echo text for debug (disabled)
                        // const text = event.message.text;
                        // await replyMessage(event.replyToken, `Echo: ${text}`, env.LINE_CHANNEL_ACCESS_TOKEN);
                    }
                } catch (err: any) {
                    console.error('Error processing event:', err);
                    if (event.replyToken) {
                        // Error handling reply
                        try {
                            await replyMessage(event.replyToken, `Error: ${err.message}`, env.LINE_CHANNEL_ACCESS_TOKEN);
                        } catch (replyErr) {
                            console.error('Failed to send error reply:', replyErr);
                        }
                    }
                }
            }));
        })());

        // Return 200 OK immediately
        return new Response('OK', { status: 200 });

    } catch (e) {
        console.error('Error processing webhook:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
}
