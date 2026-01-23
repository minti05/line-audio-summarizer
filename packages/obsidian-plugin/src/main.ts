import { Plugin } from 'obsidian';
import { LineAudioSummarizerSettingTab } from './settings';
import { CryptoManager } from './crypto';
import { ApiClient } from './api';
import { SyncManager } from './sync';

interface LineAudioSummarizerSettings {
	lineUserId: string;
	vaultId: string;
	rootFolder: string;
	useDailyNote: boolean;
	dailyNoteDateFormat: string;
	messageTemplate: string;
	// Auto Sync
	autoSync: boolean;
	syncInterval: number;
	syncOnStartup: boolean;
}

const DEFAULT_SETTINGS: LineAudioSummarizerSettings = {
	lineUserId: '',
	vaultId: '',
	rootFolder: 'VoiceSummaries',
	useDailyNote: true,
	dailyNoteDateFormat: 'YYYY-MM-DD',
	messageTemplate: '\\n## {{time}}\\n{{summary}}',
	autoSync: false,
	syncInterval: 1,
	syncOnStartup: false
}

export default class LineAudioSummarizerPlugin extends Plugin {
	settings: LineAudioSummarizerSettings;
	cryptoManager: CryptoManager;
	apiClient: ApiClient;
	syncManager: SyncManager;
	syncIntervalId: number | null = null;

	async onload() {
		await this.loadSettings();

		// サービスの初期化
		this.cryptoManager = new CryptoManager();
		await this.cryptoManager.initialize();

		this.apiClient = new ApiClient();

		// 生成されたVault IDを使用
		this.syncManager = new SyncManager(this.app, this.apiClient, this.cryptoManager, this);

		// 同期用リボンアイコンを追加
		this.addRibbonIcon('refresh-cw', 'Inboxを同期', async () => {
			await this.syncManager.syncMessages();
		});

		// 設定タブを追加
		this.addSettingTab(new LineAudioSummarizerSettingTab(this.app, this));

		// Auto Sync Initialization
		if (this.settings.syncOnStartup) {
			void this.syncManager.syncMessages();
		}
		this.configureAutoSync();
	}

	onunload() {
		if (this.syncIntervalId) {
			window.clearInterval(this.syncIntervalId);
		}
	}

	configureAutoSync() {
		if (this.syncIntervalId) {
			window.clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}

		if (this.settings.autoSync) {
			const hours = this.settings.syncInterval;
			if (hours > 0) {
				this.syncIntervalId = window.setInterval(() => {
					void this.syncManager.syncMessages();
				}, hours * 60 * 60 * 1000);
				this.registerInterval(this.syncIntervalId);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as LineAudioSummarizerSettings;
		if (!this.settings.vaultId) {
			this.settings.vaultId = crypto.randomUUID();
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
