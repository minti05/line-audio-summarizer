/**
 * Crypto Service for Obsidian Plugin (Client-Side)
 * Handles RSA key pair generation, storage, and decryption.
 */

const DB_NAME = 'LineAudioSummarizerVault';
const STORE_NAME = 'keys';
const KEY_PAIR_ID = 'user-key-pair';

// IndexedDB Helper
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getStoredKeyPair(): Promise<CryptoKeyPair | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(KEY_PAIR_ID);
        request.onsuccess = () => resolve(request.result as CryptoKeyPair || null);
        request.onerror = () => reject(request.error);
    });
}

async function storeKeyPair(keyPair: CryptoKeyPair): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(keyPair, KEY_PAIR_ID);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export class CryptoManager {
    private keyPair: CryptoKeyPair | null = null;

    async initialize() {
        this.keyPair = await getStoredKeyPair();
    }

    async generateAndSaveKeys(): Promise<string> {
        // Generate RSA-OAEP 2048 Key Pair
        this.keyPair = await crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            false, // Private key non-extractable (if supported by DB storage)
            // Note: IndexedDB can store CryptoKey objects directly.
            ["encrypt", "decrypt"]
        );

        await storeKeyPair(this.keyPair);
        return this.exportPublicKey();
    }

    async exportPublicKey(): Promise<string> {
        if (!this.keyPair) throw new Error("Keys not generated");
        const exported = await crypto.subtle.exportKey("spki", this.keyPair.publicKey);
        const base64 = arrayBufferToBase64(exported);
        return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
    }

    async decryptMessage(encryptedKeyBase64: string, ivBase64: string, encryptedDataBase64: string): Promise<string> {
        if (!this.keyPair) throw new Error("Keys not initialized");

        // 1. Unwrap AES Key using Private Key
        const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
        const aesKeyRaw = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            this.keyPair.privateKey,
            encryptedKey
        );

        // Import AES Key
        const aesKey = await crypto.subtle.importKey(
            "raw",
            aesKeyRaw,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        // 2. Decrypt Content using AES Key
        const iv = base64ToArrayBuffer(ivBase64);
        const encryptedData = base64ToArrayBuffer(encryptedDataBase64);

        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            aesKey,
            encryptedData
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
    }

    hasKeys(): boolean {
        return !!this.keyPair;
    }
}
