import { Database } from '../db';
import { inbox } from '../db/schema';
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
    await db.insert(inbox).values({
        lineUserId: data.lineUserId,
        encryptedData: data.encryptedData,
        iv: data.iv,
        encryptedKey: data.encryptedKey,
    });
}

/**
 * Get Inbox Items
 */
export async function getInboxItems(db: Database, lineUserId: string) {
    return await db.query.inbox.findMany({
        where: eq(inbox.lineUserId, lineUserId),
        orderBy: [asc(inbox.createdAt)],
    });
}

/**
 * Delete Inbox Item
 */
export async function deleteInboxItem(db: Database, id: number) {
    await db.delete(inbox).where(eq(inbox.id, id));
}
