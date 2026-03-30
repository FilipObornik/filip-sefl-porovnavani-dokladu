export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://porovnani-dokladu.app',
    'X-Title': 'Porovnani Dokladu',
  };
}
