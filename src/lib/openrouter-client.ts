import { OPENROUTER_API_KEY } from '../config/api-keys';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function openRouterHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://porovnani-dokladu.app',
    'X-Title': 'Porovnani Dokladu',
  };
}
