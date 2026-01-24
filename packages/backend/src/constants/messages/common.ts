/**
 * 一般的なメッセージ定数
 */

export const COMMON_MESSAGES = {
    DISCARDED: '破棄しました。',
    CONFIRM_MODE_ON: 'ON (確認してから保存)',
    CONFIRM_MODE_OFF: 'OFF (自動保存)',
    CONFIRM_MODE_CHANGED: (modeText: string) => `投稿前確認モードを ${modeText} に変更しました。`,
    CUSTOM_PROMPT_SET: (text: string) => `現在の設定:\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
    CANCELLED: '変更をキャンセルしました。',
    UNCHANGED: '確認しました。現在のプロンプトを維持します。',
    SAVED_TO_INBOX: 'Inboxに保存しました (暗号化済み)。Obsidianを開いて同期してください。',
};

export const STATUS_MESSAGE_TEMPLATE = (obsidianStatus: string, webhookStatus: string, promptStatus: string, confirmStatus: string) => 
    `【現在のステータス】\n` +
    `📱 Obsidian: ${obsidianStatus}\n` +
    `🔌 Webhook: ${webhookStatus}\n` +
    `📝 プロンプト: ${promptStatus}\n` +
    `✅ 投稿前確認モード: ${confirmStatus}\n\n` +
    `【コマンド一覧】\n` +
    ` /confirm : 投稿前確認モード切替\n` +
    ` /prompt : プロンプト変更\n` +
    ` /change : 連携先変更\n\n` +
    `音声メッセージを送ると要約を開始します。`;
