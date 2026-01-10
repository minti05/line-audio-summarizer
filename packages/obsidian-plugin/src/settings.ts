import { App, PluginSettingTab, Setting, Modal } from 'obsidian';
import LineAudioSummarizerPlugin from './main';

export class LineAudioSummarizerSettingTab extends PluginSettingTab {
	plugin: LineAudioSummarizerPlugin;

	constructor(app: App, plugin: LineAudioSummarizerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'LINE Audio Summarizer 設定' });

		new Setting(containerEl)
			.setName('LINE User ID')
			.setDesc('LINE Bot で /id を送信して取得したIDを入力してください。')
			.addText(text => text
				.setPlaceholder('Uxxxxxxxx...')
				.setValue(this.plugin.settings.lineUserId)
				.onChange(async (value) => {
					this.plugin.settings.lineUserId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('テンプレートファイルパス')
			.setDesc('要約メモの作成に使用するテンプレートファイルのパス。空白の場合はデフォルト設定を使用します。(例: Templates/SummaryTemplate.md)')
			.addText(text => text
				.setPlaceholder('Templates/template.md')
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
				}));

		// Key Management Section
		containerEl.createEl('h3', { text: 'セットアップ' });

		const keyStatusDiv = containerEl.createDiv();
		this.updateKeyStatus(keyStatusDiv);

		new Setting(containerEl)
			.setName('Step 1: LINE User ID の入力')
			.setDesc('LINE Bot に "/id" と送信して取得したIDを入力してください。')
			.addText(text => text
				.setPlaceholder('Uxxxxxxxx...')
				.setValue(this.plugin.settings.lineUserId)
				.onChange(async (value) => {
					this.plugin.settings.lineUserId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Step 2: デバイス登録 (鍵ペア生成)')
			.setDesc('このデバイス用の暗号化鍵を生成し、サーバーに登録します。')
			.addButton(button => button
				.setButtonText('鍵を生成して登録')
				.setCta()
				.onClick(async () => {
					if (!this.plugin.settings.lineUserId) {
						new NoticeModal(this.app, 'エラー', '先に Step 1 で LINE User ID を入力してください。').open();
						return;
					}

					try {
						button.setButtonText('生成中...').setDisabled(true);

						// 1. Register User Link
						await this.plugin.apiClient.registerUser(this.plugin.settings.lineUserId, this.plugin.settings.vaultId);

						// 2. Generate Keys
						const publicKeyPem = await this.plugin.cryptoManager.generateAndSaveKeys();

						// 3. Register Public Key
						await this.plugin.apiClient.registerPublicKey(this.plugin.settings.vaultId, publicKeyPem);

						new NoticeModal(this.app, '成功', 'デバイスの登録と鍵の生成が完了しました！\nこれで設定は完了です。').open();
						this.updateKeyStatus(keyStatusDiv);

					} catch (e: any) {
						console.error(e);
						new NoticeModal(this.app, 'エラー', `登録に失敗しました: ${e.message}`).open();
					} finally {
						button.setButtonText('鍵を生成して登録').setDisabled(false);
					}
				}));
	}

	updateKeyStatus(el: HTMLElement) {
		el.empty();
		const hasKeys = this.plugin.cryptoManager.hasKeys();
		const statusText = hasKeys ? '✅ 鍵ペア: 生成済み (安全です)' : '⚠️ 鍵ペア: 未生成';
		el.createEl('p', { text: statusText, cls: hasKeys ? 'line-audio-success' : 'line-audio-warning' });

		// Small style injection for status
		el.style.marginBottom = '1em';
		if (hasKeys) el.style.color = 'var(--text-success)';
		else el.style.color = 'var(--text-warning)';
	}
}

class NoticeModal extends Modal {
	title: string;
	message: string;

	constructor(app: App, title: string, message: string) {
		super(app);
		this.title = title;
		this.message = message;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: this.title });
		contentEl.createEl('p', { text: this.message });

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('OK')
				.onClick(() => this.close()));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
