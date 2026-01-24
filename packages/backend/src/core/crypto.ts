/**
 * Crypto Service
 * Implements Hybrid Encryption:
 * 1. Generate random AES key (256-bit) and IV (96-bit).
 * 2. Encrypt data with AES-GCM.
 * 3. Encrypt AES key with RSA-OAEP 2048 (using User's Public Key).
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

function importPublicKey(pem: string): Promise<CryptoKey> {
    // Basic PEM parsing
    const fetchKey = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/\s/g, '');

    const binaryDer = base64ToArrayBuffer(fetchKey);

    return crypto.subtle.importKey(
        'spki',
        binaryDer,
        {
            name: 'RSA-OAEP',
            hash: 'SHA-256'
        },
        true,
        ['encrypt']
    );
}

export interface EncryptedMessage {
    encryptedData: string; // Base64
    iv: string;            // Base64
    encryptedKey: string;  // Base64 (Wrapped AES Key)
}

export async function encryptWithPublicKey(data: string, publicKeyPem: string): Promise<EncryptedMessage> {
    const publicKey = await importPublicKey(publicKeyPem);

    // 1. Generate AES Key
    const aesKey = await crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256
        },
        true,
        ['encrypt']
    ) as CryptoKey;

    // 2. Encrypt Data with AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const encryptedContent = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        aesKey,
        encodedData
    );

    // 3. Encrypt AES Key with RSA-OAEP
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey) as ArrayBuffer;
    const encryptedAesKey = await crypto.subtle.encrypt(
        {
            name: 'RSA-OAEP'
        },
        publicKey,
        rawAesKey
    );

    return {
        encryptedData: arrayBufferToBase64(encryptedContent),
        iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
        encryptedKey: arrayBufferToBase64(encryptedAesKey)
    };
}
