/**
 * LINE Messaging API Signature Validation
 * @param body Request body as string
 * @param channelSecret LINE Channel Secret
 * @param signature x-line-signature header value
 */
export async function validateSignature(body: string, channelSecret: string, signature: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(channelSecret);
    const bodyData = encoder.encode(body);

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureArrayBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        bodyData
    );

    // Convert ArrayBuffer to Base64 string
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureArrayBuffer)));

    return signatureBase64 === signature;
}
