import { Env } from './types/env';
import { webhookHandler } from './handlers/line/index';
import { apiHandler } from './handlers/api/index';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/webhook') {
            return webhookHandler(request, env, ctx);
        }

        if (url.pathname.startsWith('/api/')) {
            return apiHandler(request, env);
        }

        return new Response('LINE Audio Summarizer Backend');
    },
};
