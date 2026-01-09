import { requestUrl, RequestUrlParam } from 'obsidian';

// Update this with your actual Worker URL
const DEFAULT_BACKEND_URL = 'https://line-audio-summarizer-backend.line-audio-summarizer-aoi.workers.dev';

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
            throw new Error(`Failed to register user: ${response.text}`);
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
            throw new Error(`Failed to register public key: ${response.text}`);
        }
    }

    async fetchInbox(vaultId: string): Promise<any[]> {
        const response = await requestUrl({
            url: `${this.backendUrl}/api/inbox?vaultId=${vaultId}`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status !== 200) {
            throw new Error(`Failed to fetch inbox: ${response.text}`);
        }

        const data = response.json;
        return data.messages || [];
    }
}
