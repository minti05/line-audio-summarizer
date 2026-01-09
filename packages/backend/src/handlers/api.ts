import { Env } from '../types/env';
import { upsertUserConfig } from '../services/db';

export async function apiHandler(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/api/register' && request.method === 'POST') {
        try {
            const body = await request.json() as any;
            const { lineUserId, vaultId } = body;

            if (!lineUserId || !vaultId) {
                return new Response('Missing lineUserId or vaultId', { status: 400, headers: corsHeaders });
            }

            // Save to DB (Currently just Upserting UserConfig to ensure user exists)
            // In a real app, we would enable the link here.
            // For Phase 3, we just ensure the user record exists.
            await upsertUserConfig(env.DB, {
                line_user_id: lineUserId,
                confirm_mode: 1,
                prompt_mode: 'memo',
                custom_prompt: null
            });

            // Also map Vault ID -> Line User ID in KV for reverse lookup if needed later
            // or just confirm registration success.
            await env.LINE_AUDIO_KV.put(`vault:${vaultId}`, lineUserId);
            await env.LINE_AUDIO_KV.put(`user_vault:${lineUserId}`, vaultId);

            return new Response(JSON.stringify({ success: true, message: 'Registered successfully' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (e: any) {
            console.error('Registration error:', e);
            return new Response(JSON.stringify({ success: false, error: e.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
}
