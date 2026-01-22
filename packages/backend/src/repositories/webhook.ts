import { Database } from '../db';
import { webhookConfigs } from '../db/schema';
import { eq } from 'drizzle-orm';

export type WebhookConfig = typeof webhookConfigs.$inferSelect;

/**
 * Get Webhook Config
 */
export async function getWebhookConfig(db: Database, lineUserId: string) {
    return await db.query.webhookConfigs.findFirst({
        where: eq(webhookConfigs.lineUserId, lineUserId),
    });
}

/**
 * Upsert Webhook Config
 */
export async function upsertWebhookConfig(db: Database, config: {
    lineUserId: string;
    webhookUrl: string;
    secretToken?: string | null;
    config?: string | null;
}) {
    const now = Math.floor(Date.now() / 1000);

    await db.insert(webhookConfigs).values({
        lineUserId: config.lineUserId,
        webhookUrl: config.webhookUrl,
        secretToken: config.secretToken,
        config: config.config,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: webhookConfigs.lineUserId,
        set: {
            webhookUrl: config.webhookUrl,
            secretToken: config.secretToken,
            config: config.config,
            updatedAt: now,
        },
    });
}

/**
 * Delete Webhook Config
 */
export async function deleteWebhookConfig(db: Database, lineUserId: string) {
    await db.delete(webhookConfigs).where(eq(webhookConfigs.lineUserId, lineUserId));
}
