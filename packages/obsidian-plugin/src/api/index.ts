import { requestUrl } from 'obsidian';

// Update this with your actual Worker URL
const DEFAULT_BACKEND_URL = 'https://line-audio-summarizer-backend.line-audio-summarizer-aoi.workers.dev';

export interface InboxMessage {
    id: number;
    // userId is not strictly needed for client logic but is in the response
    userId: string;
    encryptedData: string;
    iv: string;
    encryptedKey: string;
    createdAt: number;
}

export class ApiClient {
    private backendUrl: string;

    constructor(backendUrl: string = DEFAULT_BACKEND_URL) {
        this.backendUrl = backendUrl.replace(/\/$/, '');
    }

    updateUrl(url: string) {
        this.backendUrl = url.replace(/\/$/, '');
    }

    async registerUser(lineUserId: string, vaultId: string): Promise<void> {
        const response = await requestUrl({
            url: `${this.backendUrl}/api/register`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineUserId, vaultId })
        });

        if (response.status !== 200) {
            throw new Error(`ユーザー登録に失敗しました: ${response.text}`);
        }
    }

    async registerPublicKey(vaultId: string, publicKeyPem: string): Promise<void> {
        const response = await requestUrl({
            url: `${this.backendUrl}/api/keys`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vaultId, publicKeyPem })
        });

        if (response.status !== 200) {
            throw new Error(`公開鍵の登録に失敗しました: ${response.text}`);
        }
    }



    async fetchInbox(vaultId: string): Promise<InboxMessage[]> {
        const response = await requestUrl({
            url: `${this.backendUrl}/api/inbox?vaultId=${vaultId}`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status !== 200) {
            throw new Error(`Inboxの取得に失敗しました: ${response.text}`);
        }

        const data = response.json as { messages: InboxMessage[] };
        return data.messages || [];
    }
}
