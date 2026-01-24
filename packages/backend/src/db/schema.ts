import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

// Helper for timestamps
const createdAt = integer('created_at', { mode: 'number' }).default(sql`(strftime('%s', 'now'))`);
const updatedAt = integer('updated_at', { mode: 'number' }).default(sql`(strftime('%s', 'now'))`);

/**
 * Users Table
 * すべてのデータの親となるユーザー台帳
 */
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    status: text('status').default('active').notNull(), // 'active', 'archived', etc.
    createdAt,
    updatedAt,
});

/**
 * User Settings Table
 * ユーザーのアプリ設定
 */
export const userSettings = sqliteTable('user_settings', {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    confirmMode: integer('confirm_mode').default(1), // 0: OFF, 1: ON
    promptMode: text('prompt_mode').default('memo'), // 'diary', 'todo', 'memo', 'brainstorm', 'custom'
    customPrompt: text('custom_prompt'),
    createdAt,
    updatedAt,
});

/**
 * Webhook Settings Table
 * 外部連携設定
 */
export const webhookSettings = sqliteTable('webhook_settings', {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    webhookUrl: text('webhook_url').notNull(),
    secretToken: text('secret_token'),
    config: text('config'), // JSON string
    createdAt,
    updatedAt,
});

/**
 * User Keys Table
 * 公開鍵情報
 */
export const userKeys = sqliteTable('user_keys', {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    publicKeyPem: text('public_key_pem').notNull(),
    createdAt,
    updatedAt,
});

/**
 * Inbox Table
 * メッセージ格納庫
 */
export const inbox = sqliteTable('inbox', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    encryptedData: text('encrypted_data').notNull(),
    iv: text('iv').notNull(),
    encryptedKey: text('encrypted_key').notNull(),
    createdAt,
}, (table) => ({
    userIdIdx: index('idx_inbox_user_id').on(table.userId),
}));

// --- Relations ---

export const usersRelations = relations(users, ({ one, many }) => ({
    setting: one(userSettings, {
        fields: [users.id],
        references: [userSettings.userId],
    }),
    webhookSetting: one(webhookSettings, {
        fields: [users.id],
        references: [webhookSettings.userId],
    }),
    key: one(userKeys, {
        fields: [users.id],
        references: [userKeys.userId],
    }),
    inbox: many(inbox),
}));

export const inboxRelations = relations(inbox, ({ one }) => ({
    user: one(users, {
        fields: [inbox.userId],
        references: [users.id],
    }),
}));
