import { v4 as uuidv4 } from 'uuid';
import { Document, LineItem } from '../state/types';
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from '../config/api-keys';
import { parseCzechNumber } from '../lib/number-utils';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 60_000;

const EXTRACTION_PROMPT = `Analyzuj tento dokument a vytěž z něj tabulková data o položkách/produktech.
Vrať POUZE JSON pole objektů s těmito klíči:
- item_name: string (název produktu/položky)
- quantity: number | null (počet MJ)
- unit: string | null (měrná jednotka, např. ks, kg)
- unit_price: number | null (cena za MJ bez DPH)
- total_price: number | null (celková cena bez DPH)
- total_price_with_vat: number | null (celková cena s DPH)
- vat_rate: number | null (sazba DPH v %)
- sku: string | null (kód produktu/SKU)
- document_closed: boolean | null (je doklad uzavřen?)

Pravidla:
- Čísla převeď na JavaScript Number formát (1.200,50 → 1200.50)
- Pokud hodnota v dokumentu chybí, vrať null
- Zachovej českou diakritiku v názvech
- Vrať POUZE JSON pole, žádný další text`;

/**
 * Extract line items from a document image using Gemini via OpenRouter.
 */
export async function processDocument(doc: Document): Promise<LineItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://porovnani-dokladu.app',
        'X-Title': 'Porovnani Dokladu',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${doc.mimeType};base64,${doc.rawData}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Chyba autorizace: Neplatný API klíč pro OpenRouter. Zkontrolujte konfiguraci.');
      }
      if (response.status === 429) {
        throw new Error('Příliš mnoho požadavků: Překročen limit OpenRouter API. Zkuste to znovu za chvíli.');
      }
      if (response.status >= 500) {
        throw new Error(`Chyba serveru OpenRouter (${response.status}). Zkuste to znovu později.`);
      }
      throw new Error(`Chyba při komunikaci s AI službou: HTTP ${response.status}`);
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';

    if (!content) {
      throw new Error('AI vrátila prázdnou odpověď. Zkuste dokument nahrát znovu.');
    }

    const rawItems = parseJsonResponse(content);
    return rawItems.map((item: Record<string, unknown>) => normalizeLineItem(item));
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Časový limit vypršel: AI neodpověděla do 60 sekund. Zkuste to znovu.');
    }

    // Re-throw our own errors as-is
    if (error instanceof Error && error.message.startsWith('Chyba') ||
        error instanceof Error && error.message.startsWith('AI') ||
        error instanceof Error && error.message.startsWith('Příliš') ||
        error instanceof Error && error.message.startsWith('Časový') ||
        error instanceof Error && error.message.startsWith('Nepodařilo')) {
      throw error;
    }

    throw new Error(`Neočekávaná chyba při zpracování dokumentu: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Try to parse JSON array from the AI response content.
 * Handles direct JSON, markdown code blocks, and raw array patterns.
 */
function parseJsonResponse(content: string): Record<string, unknown>[] {
  // 1. Try direct JSON.parse
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    // Sometimes the model wraps the array in an object
    if (parsed && typeof parsed === 'object') {
      const values = Object.values(parsed);
      for (const val of values) {
        if (Array.isArray(val)) return val as Record<string, unknown>[];
      }
    }
  } catch {
    // continue to fallback strategies
  }

  // 2. Try extracting from markdown code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // continue
    }
  }

  // 3. Try finding a raw JSON array pattern
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // continue
    }
  }

  throw new Error('Nepodařilo se zpracovat odpověď AI. Vrácená data nejsou ve správném formátu.');
}

/**
 * Normalize a raw AI-extracted item into a proper LineItem with uuid.
 * Uses parseCzechNumber as fallback for any string numeric values.
 */
function normalizeLineItem(raw: Record<string, unknown>): LineItem {
  return {
    id: uuidv4(),
    item_name: typeof raw.item_name === 'string' ? raw.item_name : String(raw.item_name ?? ''),
    quantity: toNumber(raw.quantity),
    unit: toNullableString(raw.unit),
    unit_price: toNumber(raw.unit_price),
    total_price: toNumber(raw.total_price),
    total_price_with_vat: toNumber(raw.total_price_with_vat),
    vat_rate: toNumber(raw.vat_rate),
    sku: toNullableString(raw.sku),
    document_closed: typeof raw.document_closed === 'boolean' ? raw.document_closed : null,
  };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseCzechNumber(value);
  return null;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}
