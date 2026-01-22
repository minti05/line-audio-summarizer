import { Env } from '../../../types/env';
import { replyMessage } from '../../../clients/line';
// replyChangeTargetMessages logic is implemented inline using createChangeTargetBubble
// ※ replyChangeTargetMessages は setup.ts ではなく、元の line.ts にあった UIロジック。
// 今回の計画では ui/flex.ts に hasChangeTargetBubble はあるが、replyロジックは setup.ts に移動していない（まだ作っていない）。
// 計画における setup.ts は handleSetupMode を持つ。
// ここでは ui/flex.ts を使って新しく関数を作るか、既存を呼び出す。
import { createChangeTargetBubble, createSetupCompleteBubble } from '../../../ui/flex';
import { replyFlexMessage } from '../../../clients/line';
import { setTempState, getTempState } from '../../../utils/kv';

import { getUserConfig, getPublicKey, upsertUserConfig } from '../../../services/database/user';
import { getWebhookConfig } from '../../../services/database/webhook-config';
import { PromptMode, PROMPT_MODE_DETAILS } from '../../../core/prompts';
import { askForModeSelection } from '../flows/setup';
import { COMMON_MESSAGES, STATUS_MESSAGE_TEMPLATE } from '../../../constants/messages/common';
import { HELP_MESSAGES } from '../../../constants/messages/help';

/**
 * コマンドイベントハンドラ
 * /で始まるコマンド、または特定のキーワードに対する処理を行います。
 */
export async function handleCommandEvent(event: any, env: Env, userId: string, text: string): Promise<void> {
    const replyToken = event.replyToken;
    const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN;

    // プロンプト入力待ちかどうか確認
    const promptStateKey = `prompt_setting_state:${userId}`;
    const isSettingPrompt = await getTempState(env.LINE_AUDIO_KV, promptStateKey);

    if (isSettingPrompt) {
        // キャンセル/確認キーワードのチェック
        if (text === 'キャンセル' || text === '変更なし' || text === '変更しない' || text === 'OK' || text === '確認') {
            // 状態をクリア
            await env.LINE_AUDIO_KV.delete(promptStateKey);
            const replyText = (text === 'OK' || text === '確認')
                ? "確認しました。現在のプロンプトを維持します。"
                : "変更をキャンセルしました。";
            await replyMessage(replyToken, replyText, accessToken);
            return;
        }

        // カスタムプロンプトの更新
        const userConfig = await getUserConfig(env.DB, userId);
        await upsertUserConfig(env.DB, {
            line_user_id: userId,
            confirm_mode: userConfig?.confirm_mode ?? 1,
            prompt_mode: PromptMode.Custom,
            custom_prompt: text
        });

        // 状態をクリア
        await env.LINE_AUDIO_KV.delete(promptStateKey);

        const bubble = createSetupCompleteBubble("カスタムプロンプトを設定", `現在の設定:\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        await replyFlexMessage(replyToken, "設定完了", bubble, accessToken);
        return;
    }

    if (text === '/confirm' || text === '投稿前確認モード') {
        const config = await getUserConfig(env.DB, userId);
        const currentMode = config ? config.confirm_mode : 1;
        const newMode = currentMode === 1 ? 0 : 1;

        await upsertUserConfig(env.DB, {
            line_user_id: userId,
            confirm_mode: newMode,
            prompt_mode: config?.prompt_mode || PromptMode.Memo,
            custom_prompt: config?.custom_prompt || null
        });

        const modeText = newMode === 1 ? COMMON_MESSAGES.CONFIRM_MODE_ON : COMMON_MESSAGES.CONFIRM_MODE_OFF;
        await replyMessage(replyToken, COMMON_MESSAGES.CONFIRM_MODE_CHANGED(modeText), accessToken);
        return;
    }

    if (text === '/prompt') {
        const config = await getUserConfig(env.DB, userId);
        const currentModeKey = (config?.prompt_mode as PromptMode) || PromptMode.Memo;
        const currentModeLabel = currentModeKey === PromptMode.Custom ? 'Custom' : PROMPT_MODE_DETAILS[currentModeKey as Exclude<PromptMode, PromptMode.Custom>]?.label;
        const currentPrompt = config?.custom_prompt || "未設定 (標準)";

        const msg = `【プロンプト設定】\n現在のモード: ${currentModeLabel}\nカスタムプロンプト: ${currentPrompt}\n\n👇 モードを変更するには下のボタンを押してください。`;

        await askForModeSelection(env, userId, replyToken, [
            { type: 'text', text: msg }
        ]);
        return;
    }

    if (text === '/change' || text === '変更') {
        // 連携先変更UIを表示
        const bubble = createChangeTargetBubble();
        await replyFlexMessage(replyToken, "連携先の変更", bubble, accessToken);
        await setTempState(env.LINE_AUDIO_KV, `setup_state:${userId}`, 'changing_target', 300);
        return;
    }
    
    // 以下、コマンドではないがヘルプ表示など
    // /status やその他のテキスト
    await showStatusAndHelp(event, env, userId);
}

/**
 * ステータスとヘルプを表示します。
 */
async function showStatusAndHelp(event: any, env: Env, userId: string) {
    const userConfig = await getUserConfig(env.DB, userId);
    const webhookConfig = await getWebhookConfig(env.DB, userId);
    const publicKey = await getPublicKey(env.DB, userId);

    const confirmStatus = (userConfig?.confirm_mode ?? 1) === 1 ? 'ON' : 'OFF';
    const promptStatus = userConfig?.prompt_mode === PromptMode.Custom ? 'Custom' :
        (PROMPT_MODE_DETAILS[userConfig?.prompt_mode as Exclude<PromptMode, PromptMode.Custom>]?.label || PROMPT_MODE_DETAILS[PromptMode.Memo].label);
    const webhookStatus = webhookConfig?.webhook_url ? '設定済' : '未設定';
    const obsidianStatus = publicKey ? '連携済' : '未連携';

    const message = STATUS_MESSAGE_TEMPLATE(obsidianStatus, webhookStatus, promptStatus, confirmStatus);
    await replyMessage(event.replyToken, message, env.LINE_CHANNEL_ACCESS_TOKEN);
}
