
/**
 * Inbox Item Interface
 */
export interface InboxItem {
    id: number;
    line_user_id: string;
    encrypted_data: string;
    iv: string;
    encrypted_key: string;
    created_at: number;
}

/**
 * Add to Inbox
 */
export async function addToInbox(db: D1Database, lineUserId: string, encryptedData: string, iv: string, encryptedKey: string): Promise<void> {
    await db.prepare(`
        INSERT INTO Inbox (line_user_id, encrypted_data, iv, encrypted_key)
        VALUES (?1, ?2, ?3, ?4)
    `).bind(lineUserId, encryptedData, iv, encryptedKey).run();
}

/**
 * Get Inbox Items
 */
export async function getInboxItems(db: D1Database, lineUserId: string): Promise<InboxItem[]> {
    const { results } = await db.prepare('SELECT * FROM Inbox WHERE line_user_id = ? ORDER BY created_at ASC')
        .bind(lineUserId)
        .all<InboxItem>();
    return results;
}

/**
 * Delete Inbox Item
 */
export async function deleteInboxItem(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM Inbox WHERE id = ?').bind(id).run();
}
