import { Env } from '../../types/env';
import { createDb } from '../../db';
import { upsertUserConfig, upsertPublicKey } from '../../repositories/user';
import { getInboxItems, deleteInboxItem } from '../../repositories/inbox';

export async function apiHandler(request: Request, env: Env): Promise<Response> {
    const db = createDb(env.DB);
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
                return new Response('lineUserId または vaultId が不足しています', { status: 400, headers: corsHeaders });
            }

            // Save to DB (Upsert)
            await upsertUserConfig(db, {
                lineUserId: lineUserId,
                confirmMode: 1,
                promptMode: 'memo',
                customPrompt: null
            });

            // Map Vault ID -> Line User ID in KV
            await env.LINE_AUDIO_KV.put(`vault:${vaultId}`, lineUserId);
            await env.LINE_AUDIO_KV.put(`user_vault:${lineUserId}`, vaultId);

            return new Response(JSON.stringify({ success: true, message: '登録が完了しました' }), {
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

    // Register Public Key: POST /api/keys
    if (url.pathname === '/api/keys' && request.method === 'POST') {
        try {
            const body = await request.json() as any;
            // vaultId is used for authentication/lookup (since plugin knows it)
            const { vaultId, publicKeyPem } = body;

            if (!vaultId || !publicKeyPem) {
                return new Response('vaultId または publicKeyPem が不足しています', { status: 400, headers: corsHeaders });
            }

            // Lookup Line User ID from Vault ID
            const lineUserId = await env.LINE_AUDIO_KV.get(`vault:${vaultId}`);
            if (!lineUserId) {
                return new Response('認証エラー: Vault ID が連携されていません', { status: 401, headers: corsHeaders });
            }

            await upsertPublicKey(db, lineUserId, publicKeyPem);

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e: any) {
            console.error('Key Registration error:', e);
            return new Response(JSON.stringify({ success: false, error: e.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // Inbox: GET /api/inbox
    // Fetch pending messages and delete them (Alpha: simple pop)
    if (url.pathname === '/api/inbox' && request.method === 'GET') {
        const vaultId = url.searchParams.get('vaultId');
        if (!vaultId) {
            return new Response('vaultId が不足しています', { status: 400, headers: corsHeaders });
        }

        const lineUserId = await env.LINE_AUDIO_KV.get(`vault:${vaultId}`);
        if (!lineUserId) {
            return new Response('認証エラー', { status: 401, headers: corsHeaders });
        }

        try {
            const items = await getInboxItems(db, lineUserId);

            // Delete items after fetching (ensure at-most-once delivery roughly)
            // Ideally we should wait for ACK, but for Alpha simple polling is fine.
            // Client should persist immediately.
            for (const item of items) {
                await deleteInboxItem(db, item.id);
            }

            return new Response(JSON.stringify({ messages: items }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (e: any) {
            console.error('Inbox error:', e);
            return new Response(JSON.stringify({ success: false, error: e.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
}
