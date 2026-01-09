import { SYSTEM_PROMPT } from '../core/prompts';

/**
 * Gemini API Service
 */
export async function generateSummary(audioBuffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<string> {
    const MODEL = 'gemini-2.5-flash-lite';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    // Convert ArrayBuffer to Base64
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: SYSTEM_PROMPT
                    },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Audio
                        }
                    }
                ]
            }
        ]
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;

    // Extract text from response
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('No content generated from Gemini.');
    }
}
