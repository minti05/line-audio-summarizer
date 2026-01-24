/**
 * エラーメッセージ定数
 */

export const ERROR_MESSAGES = {
    METHOD_NOT_ALLOWED: 'Method Not Allowed',
    MISSING_SIGNATURE: 'Missing Signature',
    INVALID_SIGNATURE: 'Invalid Signature',
    INTERNAL_SERVER_ERROR: 'Internal Server Error',
    SESSION_EXPIRED: '有効期限切れのセッションです。',
    MODE_SELECTION_EXPIRED: 'モード選択の有効期限が切れています。\n再度 /prompt コマンドを実行してください。',
    INVALID_WEBHOOK_URL: '🚫 無効なURLです。https:// から始まるURLを入力してください。',
    SETUP_REQUIRED: 'まずは初期設定を完了させてください。\n利用方法を選択するか、指示に従ってください。',
    SYSTEM_ERROR_NOTIFICATION: (errMessage: string) => `システムエラーが発生しました:\n${errMessage}`,
    PUBLIC_KEY_NOT_FOUND: '公開鍵が見つかりません。Obsidianからデバイス登録を行ってください。',
    WEBHOOK_TRIGGER_FAILED: 'Webhook trigger failed',
};
