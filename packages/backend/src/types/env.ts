export interface Env {
    LINE_CHANNEL_SECRET: string;
    LINE_CHANNEL_ACCESS_TOKEN: string;
    GEMINI_API_KEY: string;

    // Bindings
    DB: D1Database;
    LINE_AUDIO_KV: KVNamespace;
}
