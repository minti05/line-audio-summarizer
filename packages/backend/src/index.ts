import { Env } from './types/env';
import { webhookHandler } from './handlers/webhook';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/webhook') {
            return webhookHandler(request, env, ctx);
        }

        return new Response('LINE Audio Summarizer Backend');
    },
};
