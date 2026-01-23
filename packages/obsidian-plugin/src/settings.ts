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

		new Setting(containerEl).setName('LINE Audio Summarizer 設定').setHeading();

		new Setting(containerEl)
			.setName('保存先フォルダ')
			.setDesc('メモを保存するルートフォルダのパス (例: VoiceSummaries)。デイリーノートと同じフォルダを指定し、ファイル名形式を一致させることで、デイリーノートに直接追記することも可能です。')
			.addText(text => text
				.setPlaceholder('VoiceSummaries')
				.setValue(this.plugin.settings.rootFolder)
				.onChange(async (value) => {
					this.plugin.settings.rootFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('デイリーノートモード')
			.setDesc('ONの場合、1日1つのファイルに追記します。OFFの場合、メッセージ毎にファイルを作成します。')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useDailyNote)
				.onChange(async (value) => {
					this.plugin.settings.useDailyNote = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('日付フォーマット (ファイル名)')
			.setDesc('デイリーノートのファイル名に使用する日付フォーマット (例: YYYY-MM-DD)')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(this.plugin.settings.dailyNoteDateFormat)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteDateFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('メッセージテンプレート')
			.setDesc('追記されるメッセージのフォーマット。{{time}}, {{summary}} が使用可能です。')
			.addTextArea(text => text
				.setPlaceholder('\\n## {{time}}\\n{{summary}}')
				.setValue(this.plugin.settings.messageTemplate)
				.onChange(async (value) => {
					this.plugin.settings.messageTemplate = value;
					await this.plugin.saveSettings();
				}));

		// Auto Sync Settings
		new Setting(containerEl).setName('自動同期設定').setHeading();

		new Setting(containerEl)
			.setName('起動時に同期')
			.setDesc('Obsidianの起動時に自動的に同期を実行します。')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.syncOnStartup = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('自動同期')
			.setDesc('一定間隔でバックグラウンド同期を実行します。')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
					
					// Apply setting change immediately
					this.plugin.configureAutoSync();
				}));

		new Setting(containerEl)
			.setName('同期間隔 (時間)')
			.setDesc('自動同期を実行する間隔 (時間単位)。')
			.addDropdown(dropdown => dropdown
				.addOption('1', '1時間')
				.addOption('2', '2時間')
				.addOption('3', '3時間')
				.addOption('4', '4時間')
				.addOption('5', '5時間')
				.setValue(String(this.plugin.settings.syncInterval))
				.onChange(async (value) => {
					this.plugin.settings.syncInterval = parseInt(value);
					await this.plugin.saveSettings();
					
					// Apply setting change immediately
					this.plugin.configureAutoSync();
				}));

		// Key Management Section
		new Setting(containerEl).setName('セットアップ').setHeading();

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
