import { Database } from '../db';
import { users, webhookSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

export type WebhookConfig = typeof webhookSettings.$inferSelect;

/**
 * Get Webhook Config
 */
export async function getWebhookConfig(db: Database, userId: string) {
    return await db.query.webhookSettings.findFirst({
        where: eq(webhookSettings.userId, userId),
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
    const userId = config.lineUserId;

    // Ensure user exists
    await db.insert(users).values({
        id: userId,
        status: 'active',
        updatedAt: now,
    }).onConflictDoUpdate({
        target: users.id,
        set: { updatedAt: now }
    });

    await db.insert(webhookSettings).values({
        userId: userId,
        webhookUrl: config.webhookUrl,
        secretToken: config.secretToken,
        config: config.config,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: webhookSettings.userId,
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
export async function deleteWebhookConfig(db: Database, userId: string) {
    await db.delete(webhookSettings).where(eq(webhookSettings.userId, userId));
}
