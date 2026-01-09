/**
 * Webhook Service
 * Sends data to external services (n8n, Make, etc.)
 */
export async function sendToWebhook(url: string, payload: any): Promise<void> {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LINE-Audio-Summarizer-Bot/1.0'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Webhook failed: ${response.status} ${response.statusText}`);
            // We do not throw here to prevent blocking the main flow, 
            // but we log it. In a robust system, we might want a retry queue.
        }
    } catch (error) {
        console.error('Error sending webhook:', error);
    }
}
