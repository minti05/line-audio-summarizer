import { App, Notice, TFile, moment } from 'obsidian';
import { ApiClient } from '../api';
import { CryptoManager } from '../crypto';

export class SyncManager {
    constructor(
        private app: App,
        private apiClient: ApiClient,
        private cryptoManager: CryptoManager,
        private vaultId: string
    ) { }

    async syncMessages(): Promise<void> {
        new Notice('Inboxを確認中...');

        try {
            // 1. Fetch Inbox
            const messages = await this.apiClient.fetchInbox(this.vaultId);

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

    private async saveToFile(text: string, timestamp: number) {
        // Folder: VoiceSummaries
        const folderName = 'VoiceSummaries';
        if (!this.app.vault.getAbstractFileByPath(folderName)) {
            await this.app.vault.createFolder(folderName);
        }

        // Filename: YYYY-MM-DD-HHmm.md
        const date = moment.unix(timestamp); // timestamp is seconds (sqlite strftime %s)
        const filename = `${folderName}/${date.format('YYYY-MM-DD-HHmm')}.md`;

        let file = this.app.vault.getAbstractFileByPath(filename);
        if (file instanceof TFile) {
            // Append if exists (unlikely with HHmm resolution unless rapid fire, but safe to append)
            await this.app.vault.append(file, `\n\n---\n\n${text}`);
        } else {
            await this.app.vault.create(filename, text);
        }
    }
}
