import { Env } from '../types/env';
import { validateSignature } from '../core/security';

export async function webhookHandler(request: Request, env: Env): Promise<Response> {
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

        // Process events (basic logging for now)
        for (const event of events) {
            console.log('Received event:', event);
            // TODO: Dispatch to specific handlers based on event type (message, follow, postback)
            if (event.type === 'message' && event.message.type === 'text') {
                // Simple echo for connectivity test (Optional: calling Messenger API to reply)
                // For now, we just acknowledge receipt.
            }
        }

        return new Response('OK', { status: 200 });

    } catch (e) {
        console.error('Error processing webhook:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
}
