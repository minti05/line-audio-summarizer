-- Migration number: 0002 	 2024-01-01T00:00:00.000Z

-- Table: PublicKeys
CREATE TABLE IF NOT EXISTS PublicKeys (
    line_user_id TEXT PRIMARY KEY,
    public_key_pem TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Table: Inbox
CREATE TABLE IF NOT EXISTS Inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_user_id TEXT NOT NULL,
    encrypted_data TEXT NOT NULL, -- Base64 encoded encrypted summary
    iv TEXT NOT NULL,             -- Base64 encoded IV
    encrypted_key TEXT NOT NULL,  -- Base64 encoded AES key (encrypted with RSA)
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_inbox_user_id ON Inbox(line_user_id);
