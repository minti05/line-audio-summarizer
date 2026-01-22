CREATE TABLE `Inbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`line_user_id` text NOT NULL,
	`encrypted_data` text NOT NULL,
	`iv` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `idx_inbox_user_id` ON `Inbox` (`line_user_id`);--> statement-breakpoint
CREATE TABLE `PublicKeys` (
	`line_user_id` text PRIMARY KEY NOT NULL,
	`public_key_pem` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `UserConfigs` (
	`line_user_id` text PRIMARY KEY NOT NULL,
	`confirm_mode` integer DEFAULT 1,
	`prompt_mode` text DEFAULT 'memo',
	`custom_prompt` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `WebhookConfigs` (
	`line_user_id` text PRIMARY KEY NOT NULL,
	`webhook_url` text NOT NULL,
	`secret_token` text,
	`config` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
