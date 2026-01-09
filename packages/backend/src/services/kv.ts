/**
 * KV Service
 */

/**
 * Set Temporary State
 * @param kv KVNamespace
 * @param key Key
 * @param value Value
 * @param ttlSeconds TTL in seconds
 */
export async function setTempState(kv: KVNamespace, key: string, value: string | object, ttlSeconds: number): Promise<void> {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    await kv.put(key, strValue, { expirationTtl: ttlSeconds });
}

/**
 * Get Temporary State
 */
export async function getTempState<T>(kv: KVNamespace, key: string): Promise<T | null> {
    const value = await kv.get(key);
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return value as unknown as T;
    }
}
