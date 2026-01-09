import { Env } from '../types/env';

/**
 * User Config Interface
 */
export interface UserConfig {
    line_user_id: string;
    confirm_mode: number;
    prompt_mode: string;
    custom_prompt: string | null;
}

/**
 * Get User Config
 */
export async function getUserConfig(db: D1Database, lineUserId: string): Promise<UserConfig | null> {
    const result = await db.prepare('SELECT * FROM UserConfigs WHERE line_user_id = ?')
        .bind(lineUserId)
        .first<UserConfig>();
    return result;
}

/**
 * Upsert User Config
 */
export async function upsertUserConfig(db: D1Database, config: UserConfig): Promise<void> {
    await db.prepare(`
        INSERT INTO UserConfigs (line_user_id, confirm_mode, prompt_mode, custom_prompt, updated_at)
        VALUES (?1, ?2, ?3, ?4, strftime('%s', 'now'))
        ON CONFLICT(line_user_id) DO UPDATE SET
            confirm_mode = ?2,
            prompt_mode = ?3,
            custom_prompt = ?4,
            updated_at = strftime('%s', 'now')
    `).bind(
        config.line_user_id,
        config.confirm_mode,
        config.prompt_mode,
        config.custom_prompt
    ).run();
}

/**
 * Public Key Interface
 */
export interface PublicKey {
    line_user_id: string;
    public_key_pem: string;
}

/**
 * Get Public Key
 */
export async function getPublicKey(db: D1Database, lineUserId: string): Promise<string | null> {
    const result = await db.prepare('SELECT public_key_pem FROM PublicKeys WHERE line_user_id = ?')
        .bind(lineUserId)
        .first<{ public_key_pem: string }>();
    return result ? result.public_key_pem : null;
}

/**
 * Upsert Public Key
 */
export async function upsertPublicKey(db: D1Database, lineUserId: string, publicKeyPem: string): Promise<void> {
    await db.prepare(`
        INSERT INTO PublicKeys (line_user_id, public_key_pem, updated_at)
        VALUES (?1, ?2, strftime('%s', 'now'))
        ON CONFLICT(line_user_id) DO UPDATE SET
            public_key_pem = ?2,
            updated_at = strftime('%s', 'now')
    `).bind(lineUserId, publicKeyPem).run();
}

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

/**
 * Webhook Config Interface
 */
export interface WebhookConfig {
    line_user_id: string;
    webhook_url: string;
    secret_token: string | null;
    config: string | null; // JSON string
}

/**
 * Get Webhook Config
 */
export async function getWebhookConfig(db: D1Database, lineUserId: string): Promise<WebhookConfig | null> {
    const result = await db.prepare('SELECT * FROM WebhookConfigs WHERE line_user_id = ?')
        .bind(lineUserId)
        .first<WebhookConfig>();
    return result;
}

/**
 * Upsert Webhook Config
 */
export async function upsertWebhookConfig(db: D1Database, config: WebhookConfig): Promise<void> {
    await db.prepare(`
        INSERT INTO WebhookConfigs (line_user_id, webhook_url, secret_token, config, updated_at)
        VALUES (?1, ?2, ?3, ?4, strftime('%s', 'now'))
        ON CONFLICT(line_user_id) DO UPDATE SET
            webhook_url = ?2,
            secret_token = ?3,
            config = ?4,
            updated_at = strftime('%s', 'now')
    `).bind(
        config.line_user_id,
        config.webhook_url,
        config.secret_token,
        config.config
    ).run();
}
