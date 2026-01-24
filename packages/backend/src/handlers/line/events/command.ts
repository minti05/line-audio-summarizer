import { Env } from '../../../types/env';
import { Database } from '../../../db';
import { replyMessage, replyFlexMessage } from '../../../clients/line';
import { createChangeTargetBubble, createSetupCompleteBubble } from '../../../constants/messages/flex';
import { setTempState, getTempState } from '../../../utils/kv';
import { getUserConfig, getPublicKey, upsertUserConfig } from '../../../repositories/user';
import { getWebhookConfig } from '../../../repositories/webhook';
import { PromptMode, PROMPT_MODE_DETAILS } from '../../../core/prompts';
import { askForModeSelection } from './setup';
import { COMMON_MESSAGES, STATUS_MESSAGE_TEMPLATE } from '../../../constants/messages/common';
import { HELP_MESSAGES } from '../../../constants/messages/help';

/**
 * コマンドイベントハンドラ
 * /で始まるコマンド、または特定のキーワードに対する処理を行います。
 */
export async function handleCommandEvent(event: any, env: Env, db: Database, userId: string, text: string): Promise<void> {
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
        const userConfig = await getUserConfig(db, userId);
        await upsertUserConfig(db, {
            lineUserId: userId,
            confirmMode: userConfig?.confirmMode ?? 1,
            promptMode: PromptMode.Custom,
            customPrompt: text
        });

        // 状態をクリア
        await env.LINE_AUDIO_KV.delete(promptStateKey);

        const bubble = createSetupCompleteBubble("カスタムプロンプトを設定", `現在の設定:\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        await replyFlexMessage(replyToken, "設定完了", bubble, accessToken);
        return;
    }

    if (text === '/confirm' || text === '投稿前確認モード') {
        const config = await getUserConfig(db, userId);
        const currentMode = config ? config.confirmMode : 1;
        const newMode = currentMode === 1 ? 0 : 1;

        await upsertUserConfig(db, {
            lineUserId: userId,
            confirmMode: newMode,
            promptMode: config?.promptMode || PromptMode.Memo,
            customPrompt: config?.customPrompt || null
        });

        const modeText = newMode === 1 ? COMMON_MESSAGES.CONFIRM_MODE_ON : COMMON_MESSAGES.CONFIRM_MODE_OFF;
        await replyMessage(replyToken, COMMON_MESSAGES.CONFIRM_MODE_CHANGED(modeText), accessToken);
        return;
    }

    if (text === '/prompt') {
        const config = await getUserConfig(db, userId);
        const currentModeKey = (config?.promptMode as PromptMode) || PromptMode.Memo;
        const currentModeLabel = currentModeKey === PromptMode.Custom ? 'Custom' : PROMPT_MODE_DETAILS[currentModeKey as Exclude<PromptMode, PromptMode.Custom>]?.label;
        const currentPrompt = config?.customPrompt || "未設定 (標準)";

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
    await showStatusAndHelp(event, env, db, userId);
}

/**
 * ステータスとヘルプを表示します。
 */
async function showStatusAndHelp(event: any, env: Env, db: Database, userId: string) {
    const userConfig = await getUserConfig(db, userId);
    const webhookConfig = await getWebhookConfig(db, userId);
    const publicKey = await getPublicKey(db, userId);

    const confirmStatus = (userConfig?.confirmMode ?? 1) === 1 ? 'ON' : 'OFF';
    const promptStatus = userConfig?.promptMode === PromptMode.Custom ? 'Custom' :
        (PROMPT_MODE_DETAILS[userConfig?.promptMode as Exclude<PromptMode, PromptMode.Custom>]?.label || PROMPT_MODE_DETAILS[PromptMode.Memo].label);
    const webhookStatus = webhookConfig?.webhookUrl ? '設定済' : '未設定';
    const obsidianStatus = publicKey ? '連携済' : '未連携';

    const message = STATUS_MESSAGE_TEMPLATE(obsidianStatus, webhookStatus, promptStatus, confirmStatus);
    await replyMessage(event.replyToken, message, env.LINE_CHANNEL_ACCESS_TOKEN);
}
