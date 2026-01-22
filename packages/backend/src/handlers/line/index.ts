import { Env } from '../../types/env';
import { validateSignature } from '../../core/security';
import { pushMessage } from '../../clients/line';
import { getUserConfig } from '../../services/database/user';
import { getTempState } from '../../utils/kv';

// Handlers
import { handleFollowEvent, handleUnfollowEvent } from './events/subscription';
import { handleMessageEvent } from './events/message';
import { handlePostbackEvent } from './events/postback';
import { handleSetupMode, determineIntegrationType } from './events/setup';

export async function webhookHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('x-line-signature');
    if (!signature) {
        return new Response('Missing Signature', { status: 401 });
    }

    const body = await request.text();

    // 署名の検証
    const isValid = await validateSignature(body, env.LINE_CHANNEL_SECRET, signature);
    if (!isValid) {
        return new Response('Invalid Signature', { status: 403 });
    }

    try {
        const data = JSON.parse(body);
        const events = data.events;

        ctx.waitUntil((async () => {
            await Promise.all(events.map(async (event: any) => {
                try {
                    const userId = event.source.userId;

                    // 1. Follow/Unfollow Events (Independent of setup status)
                    if (event.type === 'follow') {
                        await handleFollowEvent(event, env);
                        return;
                    }

                    if (event.type === 'unfollow') {
                        await handleUnfollowEvent(event, env);
                        return;
                    }

                    // 2. Setup Status Check
                    // 連携が完了しているか、または「連携なし」設定があるか確認
                    const integrationType = await determineIntegrationType(env.DB, userId);
                    const userConfig = await getUserConfig(env.DB, userId);

                    // Setup is done if integration is enabled OR user config exists (manual skip / "none" setting)
                    const isSetupDone = integrationType !== 'none' || !!userConfig;
                    const setupState = await getTempState<string>(env.LINE_AUDIO_KV, `setup_state:${userId}`);

                    // セットアップ未完了、またはセットアップ中の場合
                    if (!isSetupDone || setupState) {
                        await handleSetupMode(event, env, userId, setupState);
                        return;
                    }

                    // 3. Normal Operation
                    if (event.type === 'message') {
                        await handleMessageEvent(event, env, userId);
                    } else if (event.type === 'postback') {
                        await handlePostbackEvent(event, env);
                    }

                } catch (err: any) {
                    console.error('Error processing event:', err);
                    try {
                        // エラーが発生した場合、ユーザーに通知を試みる (デバッグ用)
                        if (event.source && event.source.userId) {
                            await pushMessage(event.source.userId, `システムエラーが発生しました:\n${err.message}`, env.LINE_CHANNEL_ACCESS_TOKEN);
                        }
                    } catch (e) {
                        console.error('Failed to send error notification:', e);
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

