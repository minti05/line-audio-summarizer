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
                        msg.encrypted_key,
                        msg.iv,
                        msg.encrypted_data
                    );

                    // 3. ファイルへの保存
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
        // 保存先フォルダ: VoiceSummaries
        const folderName = 'VoiceSummaries';
        if (!this.app.vault.getAbstractFileByPath(folderName)) {
            await this.app.vault.createFolder(folderName);
        }

        const date = moment.unix(timestamp);

        // テンプレートが利用可能な場合はコンテンツを準備
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

                // テンプレートを使用する場合、ファイル名の戦略をどうするか？
                // 現状は同じファイル名ロジックだが、ファイルが存在する場合は追記する。
                // 通常テンプレートを使用する場合、新しいファイルを作成することを意味する。
                // MVPとしては: コンテンツ作成にテンプレートを使用する。
            }
        }

        let file = this.app.vault.getAbstractFileByPath(filename);
        if (file instanceof TFile) {
            isNewFile = false;
            // 追記
            await this.app.vault.append(file, `\n\n---\n\n${summary}`); // 追記ロジックは現状シンプルに
        } else {
            // 新規ファイル
            await this.app.vault.create(filename, isNewFile && templatePath ? finalContent : summary);
        }
    }
}
