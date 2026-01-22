import { Database } from '../db';
import { users, userSettings, userKeys } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export type UserConfig = typeof userSettings.$inferSelect;
export type PublicKey = typeof userKeys.$inferSelect;

/**
 * Get User Config
 */
export async function getUserConfig(db: Database, userId: string) {
    return await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId),
    });
}

/**
 * Upsert User Config
 * Ensure user exists in 'users' table before upserting settings
 */
export async function upsertUserConfig(db: Database, config: {
    lineUserId: string; // Maintain interface compatibility
    confirmMode?: number;
    promptMode?: string;
    customPrompt?: string | null;
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
    
    await db.insert(userSettings).values({
        userId: userId,
        confirmMode: config.confirmMode,
        promptMode: config.promptMode,
        customPrompt: config.customPrompt,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: userSettings.userId,
        set: {
            confirmMode: config.confirmMode,
            promptMode: config.promptMode,
            customPrompt: config.customPrompt,
            updatedAt: now,
        },
    });
}

/**
 * Delete User Config (and User)
 * Deleting the user from 'users' table will cascade delete settings, keys, and inbox.
 */
export async function deleteUserConfig(db: Database, userId: string) {
    await db.delete(users).where(eq(users.id, userId));
}

/**
 * Get Public Key
 */
export async function getPublicKey(db: Database, userId: string) {
    const result = await db.query.userKeys.findFirst({
        where: eq(userKeys.userId, userId),
        columns: {
            publicKeyPem: true
        }
    });
    return result?.publicKeyPem ?? null;
}

/**
 * Upsert Public Key
 */
export async function upsertPublicKey(db: Database, userId: string, publicKeyPem: string) {
    const now = Math.floor(Date.now() / 1000);

    // Ensure user exists
    await db.insert(users).values({
        id: userId,
        status: 'active',
        updatedAt: now,
    }).onConflictDoUpdate({
        target: users.id,
        set: { updatedAt: now }
    });

    await db.insert(userKeys).values({
        userId,
        publicKeyPem,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: userKeys.userId,
        set: {
            publicKeyPem,
            updatedAt: now,
        },
    });
}

/**
 * Delete Public Key
 */
export async function deletePublicKey(db: Database, userId: string) {
    await db.delete(userKeys).where(eq(userKeys.userId, userId));
}
