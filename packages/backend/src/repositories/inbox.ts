import { Database } from '../db';
import { users, inbox } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

export type InboxItem = typeof inbox.$inferSelect;

/**
 * Add to Inbox
 */
export async function addToInbox(db: Database, data: {
    lineUserId: string;
    encryptedData: string;
    iv: string;
    encryptedKey: string;
}) {
    const now = Math.floor(Date.now() / 1000);
    const userId = data.lineUserId;

    // Ensure user exists
    await db.insert(users).values({
        id: userId,
        status: 'active',
        updatedAt: now,
    }).onConflictDoUpdate({
        target: users.id,
        set: { updatedAt: now }
    });

    await db.insert(inbox).values({
        userId: userId,
        encryptedData: data.encryptedData,
        iv: data.iv,
        encryptedKey: data.encryptedKey,
    });
}

/**
 * Get Inbox Items
 */
export async function getInboxItems(db: Database, userId: string) {
    return await db.query.inbox.findMany({
        where: eq(inbox.userId, userId),
        orderBy: [asc(inbox.createdAt)],
    });
}

/**
 * Delete Inbox Item
 */
export async function deleteInboxItem(db: Database, id: number) {
    await db.delete(inbox).where(eq(inbox.id, id));
}
