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
            // 1. Fetch Inbox
            const messages = await this.apiClient.fetchInbox(this.plugin.settings.vaultId);

            if (messages.length === 0) {
                new Notice('新しいメッセージはありません。');
                return;
            }

            new Notice(`${messages.length} 件のメッセージを受信しました。復号中...`);

            // 2. Decrypt and Save
            let savedCount = 0;
            for (const msg of messages) {
                try {
                    const decryptedText = await this.cryptoManager.decryptMessage(
                        msg.encrypted_key,
                        msg.iv,
                        msg.encrypted_data
                    );

                    // 3. Save to File
                    await this.saveToFile(decryptedText, msg.created_at);
                    savedCount++;
                } catch (err) {
                    console.error('Decryption failed for message:', msg.id, err);
                    new Notice(`メッセージID ${msg.id} の復号に失敗しました。`);
                }
            }

            if (savedCount > 0) {
                new Notice(`${savedCount} 件のメモを保存しました！`);
            }

        } catch (e: any) {
            console.error('Sync failed:', e);
            new Notice(`同期に失敗しました: ${e.message}`);
        }
    }

    private async saveToFile(summary: string, timestamp: number) {
        // Folder: VoiceSummaries
        const folderName = 'VoiceSummaries';
        if (!this.app.vault.getAbstractFileByPath(folderName)) {
            await this.app.vault.createFolder(folderName);
        }

        const date = moment.unix(timestamp);

        // Prepare content with template if available
        let finalContent = `\n\n---\n\n${summary}`;
        let filename = `${folderName}/${date.format('YYYY-MM-DD-HHmm')}.md`;
        let isNewFile = true;

        const templatePath = this.plugin.settings.templatePath;
        if (templatePath) {
            const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
            if (templateFile instanceof TFile) {
                const templateContent = await this.app.vault.read(templateFile);
                finalContent = templateContent
                    .replace(/{{date}}/g, date.format('YYYY-MM-DD'))
                    .replace(/{{datetime}}/g, date.format('YYYY-MM-DD HH:mm'))
                    .replace(/{{summary}}/g, summary);

                // If using template, maybe we want a different filename strategy? 
                // For now, keep same filename logic but if file exists, we append to it differently?
                // Actually, if a template is used, it usually implies creating a NEW file for each note.
                // But the current logic supports appending.
                // Let's assume if it's a new file, we use template. If appending, we just append summary.
                // Or maybe we treat every message as a separate file if template is active?
                // For simple MVP: Use template for content creation.
            }
        }

        let file = this.app.vault.getAbstractFileByPath(filename);
        if (file instanceof TFile) {
            isNewFile = false;
            // Append
            await this.app.vault.append(file, `\n\n---\n\n${summary}`); // Append logic remains simple for now
        } else {
            // New File
            await this.app.vault.create(filename, isNewFile && templatePath ? finalContent : summary);
        }
    }
}
