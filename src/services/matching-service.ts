import { v4 as uuidv4 } from 'uuid';
import { LineItem, MatchingPair } from '../state/types';
import { levenshteinSimilarity } from '../lib/levenshtein';
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from '../config/api-keys';

const SIMILARITY_THRESHOLD = 0.40;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MATCH_TIMEOUT_MS = 30_000;

/**
 * Strip internal fields from LineItem for the AI prompt.
 */
function itemForPrompt(item: LineItem, index: number) {
  return {
    index,
    item_name: item.item_name,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total_price: item.total_price,
    sku: item.sku,
  };
}

const MATCHING_PROMPT = `Jsi expert na párování položek mezi fakturou a příjemkou.

Dostaneš dva seznamy položek (faktura a příjemka). Každá položka má index, název, množství, jednotku, jednotkovou cenu, celkovou cenu a SKU.

Tvůj úkol:
1. Spáruj položky z faktury s položkami z příjemky (1:1 párování).
2. SKU kód je nejsilnější signál — pokud se shoduje, položky patří k sobě.
3. Názvy položek porovnávej sémanticky — mohou být přeformulované, zkrácené nebo v jiném pořadí slov.
4. Množství a cena slouží jako pomocné signály pro potvrzení shody.
5. Pokud si nejsi jistý párováním, položku přeskoč — nepáruj násilně.
6. Každá položka může být spárována nejvýše jednou.

Vrať POUZE JSON objekt v tomto formátu:
{"pairs": [{"invoice_index": 0, "receipt_index": 2}, ...]}

Pokud žádné páry nenajdeš, vrať: {"pairs": []}`;

/**
 * Match items using Gemini AI via OpenRouter.
 */
async function aiMatch(invoiceItems: LineItem[], receiptItems: LineItem[]): Promise<MatchingPair[]> {
  const invoiceData = invoiceItems.map((item, i) => itemForPrompt(item, i));
  const receiptData = receiptItems.map((item, i) => itemForPrompt(item, i));

  const userMessage = `Faktura položky:\n${JSON.stringify(invoiceData, null, 2)}\n\nPříjemka položky:\n${JSON.stringify(receiptData, null, 2)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_MATCH_TIMEOUT_MS);

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
          { role: 'system', content: MATCHING_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI matching HTTP ${response.status}`);
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';

    if (!content) {
      throw new Error('AI matching returned empty response');
    }

    const parsed = JSON.parse(content);
    const rawPairs: unknown[] = Array.isArray(parsed?.pairs) ? parsed.pairs : [];

    // Validate and deduplicate
    const usedInvoice = new Set<number>();
    const usedReceipt = new Set<number>();
    const pairs: MatchingPair[] = [];

    for (const raw of rawPairs) {
      if (typeof raw !== 'object' || raw === null) continue;
      const p = raw as Record<string, unknown>;
      const ii = p.invoice_index;
      const ri = p.receipt_index;

      if (typeof ii !== 'number' || typeof ri !== 'number') continue;
      if (!Number.isInteger(ii) || !Number.isInteger(ri)) continue;
      if (ii < 0 || ii >= invoiceItems.length) continue;
      if (ri < 0 || ri >= receiptItems.length) continue;
      if (usedInvoice.has(ii) || usedReceipt.has(ri)) continue;

      usedInvoice.add(ii);
      usedReceipt.add(ri);

      pairs.push({
        id: uuidv4(),
        invoiceItem: invoiceItems[ii],
        receiptItem: receiptItems[ri],
        reviewed: false,
      });
    }

    return pairs;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Levenshtein-based greedy matching (fallback).
 */
function levenshteinMatch(invoiceItems: LineItem[], receiptItems: LineItem[]): MatchingPair[] {
  const pairs: MatchingPair[] = [];
  const usedReceiptIds = new Set<string>();

  const sortedInvoice = [...invoiceItems].sort(
    (a, b) => (b.item_name?.length ?? 0) - (a.item_name?.length ?? 0)
  );

  for (const invoiceItem of sortedInvoice) {
    const invoiceName = (invoiceItem.item_name ?? '').toLowerCase();

    let bestMatch: LineItem | null = null;
    let bestSimilarity = 0;

    for (const receiptItem of receiptItems) {
      if (usedReceiptIds.has(receiptItem.id)) continue;

      const receiptName = (receiptItem.item_name ?? '').toLowerCase();
      const similarity = levenshteinSimilarity(invoiceName, receiptName);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = receiptItem;
      }
    }

    if (bestMatch && bestSimilarity > SIMILARITY_THRESHOLD) {
      usedReceiptIds.add(bestMatch.id);
      pairs.push({
        id: uuidv4(),
        invoiceItem,
        receiptItem: bestMatch,
        reviewed: false,
      });
    }
  }

  return pairs;
}

/**
 * Auto-match invoice and receipt items.
 * Uses AI (Gemini) for semantic matching, falls back to Levenshtein on failure.
 */
export async function autoMatch(
  invoiceItems: LineItem[],
  receiptItems: LineItem[]
): Promise<MatchingPair[]> {
  if (invoiceItems.length === 0 || receiptItems.length === 0) return [];

  try {
    return await aiMatch(invoiceItems, receiptItems);
  } catch (error) {
    console.warn('AI matching failed, falling back to Levenshtein:', error);
    return levenshteinMatch(invoiceItems, receiptItems);
  }
}
