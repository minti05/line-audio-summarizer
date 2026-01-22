
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
