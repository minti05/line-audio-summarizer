import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Helper for timestamps
const createdAt = integer('created_at', { mode: 'number' }).default(sql`(strftime('%s', 'now'))`);
const updatedAt = integer('updated_at', { mode: 'number' }).default(sql`(strftime('%s', 'now'))`);

/**
 * UserConfigs Table
 */
export const userConfigs = sqliteTable('UserConfigs', {
    lineUserId: text('line_user_id').primaryKey(),
    confirmMode: integer('confirm_mode').default(1), // 0: OFF, 1: ON
    promptMode: text('prompt_mode').default('memo'), // 'diary', 'todo', 'memo', 'brainstorm', 'custom'
    customPrompt: text('custom_prompt'),
    createdAt,
    updatedAt,
});

/**
 * WebhookConfigs Table
 */
export const webhookConfigs = sqliteTable('WebhookConfigs', {
    lineUserId: text('line_user_id').primaryKey(),
    webhookUrl: text('webhook_url').notNull(),
    secretToken: text('secret_token'),
    config: text('config'), // JSON string
    createdAt,
    updatedAt,
});

/**
 * PublicKeys Table
 */
export const publicKeys = sqliteTable('PublicKeys', {
    lineUserId: text('line_user_id').primaryKey(),
    publicKeyPem: text('public_key_pem').notNull(),
    createdAt,
    updatedAt,
});

/**
 * Inbox Table
 */
export const inbox = sqliteTable('Inbox', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    lineUserId: text('line_user_id').notNull(),
    encryptedData: text('encrypted_data').notNull(), // Base64 encoded encrypted summary
    iv: text('iv').notNull(),             // Base64 encoded IV
    encryptedKey: text('encrypted_key').notNull(),  // Base64 encoded AES key (encrypted with RSA)
    createdAt,
}, (table) => ({
    userIdIdx: index('idx_inbox_user_id').on(table.lineUserId),
}));
