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
