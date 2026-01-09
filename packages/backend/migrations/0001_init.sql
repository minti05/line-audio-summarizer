-- Migration number: 0001 	 2024-01-01T00:00:00.000Z
-- Table: UserConfigs
CREATE TABLE IF NOT EXISTS UserConfigs (
    line_user_id TEXT PRIMARY KEY,
    confirm_mode INTEGER DEFAULT 1, -- 0: OFF, 1: ON
    prompt_mode TEXT DEFAULT 'memo', -- 'diary', 'todo', 'memo', 'brainstorm', 'custom'
    custom_prompt TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Table: WebhookConfigs
CREATE TABLE IF NOT EXISTS WebhookConfigs (
    line_user_id TEXT PRIMARY KEY,
    webhook_url TEXT NOT NULL,
    secret_token TEXT,
    config JSON,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
