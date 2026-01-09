import { Plugin } from 'obsidian';
import { LineAudioSummarizerSettingTab } from './settings';
import { CryptoManager } from './crypto';
import { ApiClient } from './api';
import { SyncManager } from './sync';

interface LineAudioSummarizerSettings {
	lineUserId: string;
	vaultId: string;
	templatePath: string;
}

const DEFAULT_SETTINGS: LineAudioSummarizerSettings = {
	lineUserId: '',
	vaultId: '',
	templatePath: ''
}

export default class LineAudioSummarizerPlugin extends Plugin {
	settings: LineAudioSummarizerSettings;
	cryptoManager: CryptoManager;
	apiClient: ApiClient;
	syncManager: SyncManager;

	async onload() {
		await this.loadSettings();

		// Initialize Services
		this.cryptoManager = new CryptoManager();
		await this.cryptoManager.initialize();

		this.apiClient = new ApiClient();

		// Use Generated Vault ID
		this.syncManager = new SyncManager(this.app, this.apiClient, this.cryptoManager, this);

		// Add Ribbon Icon for Sync
		this.addRibbonIcon('refresh-cw', 'Inboxを同期', async () => {
			await this.syncManager.syncMessages();
		});

		// Add Settings Tab
		this.addSettingTab(new LineAudioSummarizerSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (!this.settings.vaultId) {
			this.settings.vaultId = crypto.randomUUID();
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
