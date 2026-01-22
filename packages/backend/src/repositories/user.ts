import { Database } from '../db';
import { userConfigs, publicKeys } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { PromptMode } from '../core/prompts';

export type UserConfig = typeof userConfigs.$inferSelect;
export type PublicKey = typeof publicKeys.$inferSelect;

/**
 * Get User Config
 */
export async function getUserConfig(db: Database, lineUserId: string) {
    return await db.query.userConfigs.findFirst({
        where: eq(userConfigs.lineUserId, lineUserId),
    });
}

/**
 * Upsert User Config
 */
export async function upsertUserConfig(db: Database, config: {
    lineUserId: string;
    confirmMode?: number;
    promptMode?: string;
    customPrompt?: string | null;
}) {
    const now = Math.floor(Date.now() / 1000);
    
    await db.insert(userConfigs).values({
        lineUserId: config.lineUserId,
        confirmMode: config.confirmMode,
        promptMode: config.promptMode,
        customPrompt: config.customPrompt,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: userConfigs.lineUserId,
        set: {
            confirmMode: config.confirmMode,
            promptMode: config.promptMode,
            customPrompt: config.customPrompt,
            updatedAt: now,
        },
    });
}

/**
 * Delete User Config
 */
export async function deleteUserConfig(db: Database, lineUserId: string) {
    await db.delete(userConfigs).where(eq(userConfigs.lineUserId, lineUserId));
}

/**
 * Get Public Key
 */
export async function getPublicKey(db: Database, lineUserId: string) {
    const result = await db.query.publicKeys.findFirst({
        where: eq(publicKeys.lineUserId, lineUserId),
        columns: {
            publicKeyPem: true
        }
    });
    return result?.publicKeyPem ?? null;
}

/**
 * Upsert Public Key
 */
export async function upsertPublicKey(db: Database, lineUserId: string, publicKeyPem: string) {
    const now = Math.floor(Date.now() / 1000);

    await db.insert(publicKeys).values({
        lineUserId,
        publicKeyPem,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: publicKeys.lineUserId,
        set: {
            publicKeyPem,
            updatedAt: now,
        },
    });
}

/**
 * Delete Public Key
 */
export async function deletePublicKey(db: Database, lineUserId: string) {
    await db.delete(publicKeys).where(eq(publicKeys.lineUserId, lineUserId));
}
