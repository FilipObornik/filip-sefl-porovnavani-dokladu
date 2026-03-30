export interface ModelConfig {
  id: string;
  name: string;
}

export const CURATED_MODELS: ModelConfig[] = [
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6' },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
];

export const DEFAULT_MODEL = 'google/gemini-3-pro-preview';
