
import { Env } from '../../types/env';
import { PromptMode } from '../../core/prompts';

/**
 * User Config Interface
 */
export interface UserConfig {
    line_user_id: string;
    confirm_mode: number;
    prompt_mode: PromptMode | string;
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
