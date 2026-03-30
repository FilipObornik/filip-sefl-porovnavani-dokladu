export interface ModelConfig {
  id: string;
  name: string;
}

export const CURATED_MODELS: ModelConfig[] = [
  { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro Preview' },
  { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash Preview' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5' },
  { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
];

export const DEFAULT_MODEL = 'google/gemini-3.1-pro-preview';
