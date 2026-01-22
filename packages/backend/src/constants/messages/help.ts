/**
 * ヘルプ・案内メッセージ定数
 */

export const HELP_MESSAGES = {
    INITIAL_SETUP_TEXT: "友達追加ありがとうございます！\n\nこのLINE Audio Summarizerでできることは大きく2つです。\n\n1️⃣ Obsidian連携\n音声要約をクラウド経由で同期し、Obsidianに自動保存します。\n\n2️⃣ Webhook連携\n要約結果をWebhookで送信し、SlackやXなど、お好きなサービスと連携できます。\n\n👇 以下のボタンから、利用方法を選択してください。",
    CHANGE_TARGET_TEXT: "連携先を変更します。\n\n現在設定されている連携先は上書きされます。\n\n👇 以下のボタンから、新しい連携先を選択してください。\n\n※ 変更をやめる場合は、「キャンセル」と送信してください。",
    SETUP_OBSIDIAN_INSTRUCTION: (userId: string) => [
        { type: 'text', text: `あなたのUser IDは以下です。コピーしてObsidianの設定に入力してください。` },
        { type: 'text', text: userId },
        { type: 'text', text: `設定が完了したら、このチャットに「完了」や「OK」など、何かメッセージを送ってください。\nそれをもって連携確認を行います。` }
    ],
    SETUP_WEBHOOK_INSTRUCTION: [
        { type: 'text', text: `連携するWebhook URL (https://...) を入力して送信してください。` }
    ],
    SETUP_NOTHING_CONFIRMATION: "設定を「連携なし」に変更しました。",
    OBSIDIAN_LINKED: "✅ Obsidian連携が確認できました！",
    WEBHOOK_LINKED: "✅ Webhook連携を設定しました！",
    SETUP_NOT_CONFIRMED: "🚫 まだ連携が確認できませんでした。\nObsidian側で設定を行い、再度メッセージを送ってください。",
    CUSTOM_PROMPT_INSTRUCTION: "✏️ オリジナルのプロンプトを設定するには、このメッセージに返信する形で新しいプロンプトを入力してください。",
    WELCOME_TITLE: "LINE Audio Summarizerへようこそ！利用モードを選択してください。",
    MODE_SELECTION_TITLE: "モード選択",
    CONFIRMATION_TITLE: "要約が作成されました",
    SETUP_COMPLETE_TITLE: "設定完了",
};
