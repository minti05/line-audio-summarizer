# Line Audio Summarizer

Line Audio Summarizer is an Obsidian plugin that links your LINE messaging app with your Obsidian vault. It allows you to record voice notes on the go, automatically transcribes and summarizes them using Gemini 1.5 Flash, and syncs the results directly to Obsidian.

"Speak and build assets for tomorrow." — Capture ideas, diary entries, and TODOs effortlessly without typing.

## Key Features

*   **🎙️ Voice Transcription & AI Summarization:**
    *   Powered by **Gemini 1.5 Flash** for fast and accurate speech-to-text.
    *   Automatically summarizes content based on your needs.
*   **🧠 4 Smart Modes:**
    *   **Diary Mode:** Captures events and emotions with an empathetic tone.
    *   **TODO Mode:** Extracts action items and creates checklists.
    *   **Memo Mode:** Quickly jots down fleeting ideas.
    *   **Brainstorming Mode:** Structures thoughts and customizes "questions" to deepen your thinking.
    *   *(You can also set custom prompts via `/prompt` command in LINE)*
*   **🔄 Seamless Sync:**
    *   **Obsidian Integration:** Save summaries to your Daily Notes or as separate files.
    *   **Webhook Support:** Connect to n8n, Make, or Zapier to send data to Slack, Notion, etc.
*   **🔒 Secure & Private:**
    *   End-to-End Encryption (E2EE) ensuring your data is decrypted only on your device.
*   **✅ Confidence Check:**
    *   Review and approve the AI summary in LINE before it syncs to Obsidian.

## How it Works

1.  **Record:** Send a voice message or audio file to the "Line Audio Summarizer" LINE Official Account.
2.  **Process:** The bot analyzes the audio, transcribing it and generating a structured summary.
3.  **Review (Optional):** You receive the summary in LINE. Tap "Send" to confirm.
4.  **Sync:** The note appears instantly in your Obsidian vault.

## Installation

### Manual Installation (For Development/Beta)

1.  Download the latest release (`main.js`, `manifest.json`, `styles.css`) from the GitHub repository.
2.  Create a folder named `line-audio-summarizer` inside your vault's plugin directory: `.obsidian/plugins/`.
3.  Move the downloaded files into that folder.
4.  Open Obsidian, go to **Settings > Community Plugins**, and enable **Line Audio Summarizer**.

### From Community Plugins (Future)

1.  Open **Settings > Community Plugins** in Obsidian.
2.  Turn off "Safe mode".
3.  Click "Browse" and search for "Line Audio Summarizer".
4.  Click "Install" and then "Enable".

## Setup & Configuration

### 1. Connect to LINE Bot

1.  Add the [LINE Official Account](https://line.me/R/ti/p/@382cjrxw) as a friend.
2.  In the LINE chat, type the way of using the bot and get your **User ID**.

### 2. Configure Obsidian Plugin

1.  Go to **Settings > Line Audio Summarizer** in Obsidian.
2.  **LINE User ID:** Paste the User ID you got from the LINE bot.
3.  **Sync Settings:**
    *   Choose where to save notes (Daily Note or specific folder).
    *   Set the template to be used.
4.  Click **Connect** to verify the link.

## Usage

### LINE Commands

You can control the bot directly from LINE using slash commands:

-   `/id`: Show your LINE User ID.
-   `/prompt`: Check or customize the current AI system prompt.
-   `/confirm`: Toggle the "Confirm before sending" feature (ON/OFF).
-   `/vault`: Check or switch the active destination vault.
-   `/webhook`: Configure Webhook URLs for external integrations.
-   `/status`: Check current connection status.

## Development

If you want to modify or contribute to this plugin:

1.  Clone this repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm run dev` to start compilation in watch mode.

```bash
git clone https://github.com/minti05/line-audio-summarizer.git
cd line-audio-summarizer
npm install
npm run dev
```

## detailed information

For more detailed information about the project's background and design, please refer to the documentation in the `docs` folder.

-   [Project Proposal](docs/企画書.md)
-   [UX Design](docs/UX設計.md)
