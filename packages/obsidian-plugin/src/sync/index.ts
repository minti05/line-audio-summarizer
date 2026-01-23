import { App, Notice, TFile, moment } from 'obsidian';
import { ApiClient } from '../api';
import { CryptoManager } from '../crypto';

import LineAudioSummarizerPlugin from '../main';

export class SyncManager {
    constructor(
        private app: App,
        private apiClient: ApiClient,
        private cryptoManager: CryptoManager,
        private plugin: LineAudioSummarizerPlugin
    ) { }

    async syncMessages(): Promise<void> {
        new Notice('Inboxを確認中...');

        try {
            // 1. Inboxの取得
            const messages = await this.apiClient.fetchInbox(this.plugin.settings.vaultId);

            if (messages.length === 0) {
                new Notice('新しいメッセージはありません。');
                return;
            }

            new Notice(`${messages.length} 件のメッセージを受信しました。復号中...`);

            // 2. 復号と保存
            let savedCount = 0;
            for (const msg of messages) {
                try {
                    const decryptedText = await this.cryptoManager.decryptMessage(
                        msg.encryptedKey,
                        msg.iv,
                        msg.encryptedData
                    );

                    // 3. ファイルへの保存
                    await this.saveToFile(decryptedText, msg.createdAt);
                    savedCount++;
                } catch (err) {
                    console.error('Decryption failed for message:', msg.id, err);
                    new Notice(`メッセージID ${msg.id} の復号に失敗しました。`);
                }
            }

            if (savedCount > 0) {
                new Notice(`${savedCount} 件のメモを保存しました！`);
            }

        } catch (e: unknown) {
            console.error('Sync failed:', e);
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            new Notice(`同期に失敗しました: ${errorMessage}`);
        }
    }

    private async saveToFile(summary: string, timestamp: number) {
        const { rootFolder, useDailyNote, dailyNoteDateFormat, messageTemplate } = this.plugin.settings;

        // 1. Ensure Root Folder Exists
        const folderPath = rootFolder || 'VoiceSummaries';
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            await this.app.vault.createFolder(folderPath);
        }

        const date = moment.unix(timestamp);

        // 2. Prepare Content using Template
        // Replace newline characters explicitly if they are escaped in the settings string
        const template = messageTemplate.replace(/\\n/g, '\n');
        
        const formattedDate = date.format('YYYY-MM-DD');
        const formattedTime = date.format('HH:mm');
        const formattedDateTime = date.format('YYYY-MM-DD HH:mm');

        const content = template
            .replace(/{{summary}}/g, summary)
            .replace(/{{date}}/g, formattedDate)
            .replace(/{{time}}/g, formattedTime)
            .replace(/{{datetime}}/g, formattedDateTime);

        // 3. Determine Filename
        let filename: string;
        if (useDailyNote) {
             const dateFormat = dailyNoteDateFormat || 'YYYY-MM-DD';
             filename = `${folderPath}/${date.format(dateFormat)}.md`;
        } else {
             // Individual Note mode: use precision to avoid collision
             filename = `${folderPath}/${date.format('YYYY-MM-DD-HHmm-ss')}.md`;
        }

        // 4. Save (Create or Append)
        let file = this.app.vault.getAbstractFileByPath(filename);
        if (file instanceof TFile) {
            // Append
            await this.app.vault.append(file, content);
        } else {
            // Create New
            await this.app.vault.create(filename, content);
        }
    }
}
