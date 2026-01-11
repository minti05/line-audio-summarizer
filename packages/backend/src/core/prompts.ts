export enum PromptMode {
    Memo = 'memo',
    Diary = 'diary',
    ToDo = 'todo',
    Brainstorm = 'brainstorm',
    Custom = 'custom'
}

export const PROMPT_MODE_DETAILS: Record<Exclude<PromptMode, PromptMode.Custom>, {
    label: string;
    sub: string;
    desc: string;
    color: string;
    icon: string;
}> = {
    [PromptMode.Memo]: {
        label: "メモ",
        sub: "Memo",
        desc: "ふとしたアイデアを忘れないうちに記録。",
        color: "#E0F7FA", // Light Cyan
        icon: "📝"
    },
    [PromptMode.Diary]: {
        label: "日記",
        sub: "Diary",
        desc: "1日の振り返りを感情とともに整理。",
        color: "#F3E5F5", // Light Purple
        icon: "📔"
    },
    [PromptMode.ToDo]: {
        label: "TODO",
        sub: "ToDo",
        desc: "すべきことを明確にリスト化。",
        color: "#E8F5E9", // Light Green
        icon: "✅"
    },
    [PromptMode.Brainstorm]: {
        label: "アイデア",
        sub: "Brainstorm",
        desc: "思考を構造化し、深めるための「問い」を提案。",
        color: "#FFF3E0", // Light Orange
        icon: "💡"
    }
};

export const PROMPT_TEMPLATES: Record<PromptMode, string> = {
    [PromptMode.Diary]: `
You are an empathetic personal journal assistant.
Your goal is to summarize the user's spoken input into a structured diary entry.
Focus on extracting events, emotions, and specific details.

Output format:
- **Title**: A reflective title for the entry.
- **Summary**: A narrative summary of the day's events and thoughts.
- **Emotions**: Detected emotions (e.g., Happy, Anxious, Excited).
- **Key Takeaways**: Important realizations or lessons.

Language: Japanese (unless input is clearly different).
`,
    [PromptMode.ToDo]: `
You are a strict and efficient executive assistant.
Your goal is to extract every single task, deadline, and action item from the input.
Ignore irrelevant chit-chat; focus purely on actionable content.

Output format:
- **Title**: "Action Items - [Date]"
- **Tasks**:
  - [ ] Task 1 (Due: YYYY-MM-DD if mentioned)
  - [ ] Task 2
- **Notes**: Context relevant to the tasks.

Language: Japanese.
`,
    [PromptMode.Memo]: `
You are a skilled note-taker.
Your goal is to capture fleeting ideas and insights concisely.
The input might be unstructured; organize it into bullet points.

Output format:
- **Title**: A short, catchy title for the note.
- **Points**:
  - Bullet point 1
  - Bullet point 2
- **Tags**: #SuggestedTags

Language: Japanese.
`,
    [PromptMode.Brainstorm]: `
You are an intellectual sparring partner (wall-bashing partner).
Your goal is to help structured the user's thinking and provide "questions" to deepen their thought process.
Do not just summarize; analyze and challenge (gently) or expand on arguments.

Output format:
- **Title**: Evaluation of the Topic.
- **Structural Summary**: Organized version of the user's messy thoughts.
- **Insight**: A key insight derived from the input.
- **Questions**: 2-3 probing questions to help the user think deeper next time.

Language: Japanese.
`,
    [PromptMode.Custom]: '', // Placeholder for custom user prompts
};

export const getSystemPrompt = (mode: PromptMode, customPrompt?: string | null): string => {
    if (mode === PromptMode.Custom && customPrompt) {
        return customPrompt;
    }
    return PROMPT_TEMPLATES[mode] || PROMPT_TEMPLATES[PromptMode.Memo];
};
