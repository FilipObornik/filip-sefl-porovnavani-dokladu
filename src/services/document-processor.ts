import { v4 as uuidv4 } from 'uuid';
import { Document, DocumentTotals, LineItem } from '../state/types';

export class DocumentProcessorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentProcessorError';
  }
}
import { OPENROUTER_MODEL } from '../config/api-keys';
import { parseCzechNumber } from '../lib/number-utils';
import { OPENROUTER_URL, openRouterHeaders } from '../lib/openrouter-client';

export interface ProcessDocumentResult {
  items: LineItem[];
  documentTotals: DocumentTotals | null;
  documentClosed: boolean | null;
}

const TIMEOUT_MS = 60_000;

const EXTRACTION_PROMPT = `Analyzuj tento dokument a vytěž z něj data.
Vrať JSON objekt s těmito klíči:

1. "items": pole objektů s položkami/produkty, každý s klíči:
   - item_name: string (název produktu/položky)
   - quantity: number | null (počet MJ)
   - unit: string | null (měrná jednotka, např. ks, kg)
   - unit_price: number | null (cena za MJ bez DPH)
   - total_price: number | null (celková cena bez DPH)
   - total_price_with_vat: number | null (celková cena s DPH)
   - vat_rate: number | null (sazba DPH v %)
   - sku: string | null (kód produktu/SKU)

2. "document_totals": objekt s celkovými hodnotami přímo z dokladu (z patičky/záhlaví dokladu, NE součtem položek):
   - total_price: number | null (celková cena bez DPH dle dokladu)
   - total_vat: number | null (celková DPH dle dokladu)
   - total_price_with_vat: number | null (celková cena s DPH dle dokladu)
   - document_closed: boolean | null (je doklad uzavřen/potvrzený?)

Pravidla:
- Čísla převeď na JavaScript Number formát (1.200,50 → 1200.50)
- Pokud hodnota v dokumentu chybí, vrať null
- Zachovej českou diakritiku v názvech
- Vrať POUZE JSON objekt, žádný další text`;

/**
 * Extract line items and document-level totals from a document image using Gemini via OpenRouter.
 */
export async function processDocument(doc: Document): Promise<ProcessDocumentResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: openRouterHeaders(),
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
        throw new DocumentProcessorError('Chyba autorizace: Neplatný API klíč pro OpenRouter. Zkontrolujte konfiguraci.');
      }
      if (response.status === 429) {
        throw new DocumentProcessorError('Příliš mnoho požadavků: Překročen limit OpenRouter API. Zkuste to znovu za chvíli.');
      }
      if (response.status >= 500) {
        throw new DocumentProcessorError(`Chyba serveru OpenRouter (${response.status}). Zkuste to znovu později.`);
      }
      throw new DocumentProcessorError(`Chyba při komunikaci s AI službou: HTTP ${response.status}`);
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';

    if (!content) {
      throw new DocumentProcessorError('AI vrátila prázdnou odpověď. Zkuste dokument nahrát znovu.');
    }

    const { rawItems, rawTotals } = parseFullResponse(content);
    const items = rawItems.map((item: Record<string, unknown>) => deriveLineItemFields(normalizeLineItem(item)));
    const documentTotals = normalizeDocumentTotals(rawTotals);
    const documentClosed = rawTotals && typeof rawTotals.document_closed === 'boolean'
      ? rawTotals.document_closed
      : null;
    return { items, documentTotals, documentClosed };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DocumentProcessorError('Časový limit vypršel: AI neodpověděla do 60 sekund. Zkuste to znovu.');
    }

    // Re-throw our own errors as-is
    if (error instanceof DocumentProcessorError) {
      throw error;
    }

    throw new DocumentProcessorError(`Neočekávaná chyba při zpracování dokumentu: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface ParsedResponse {
  rawItems: Record<string, unknown>[];
  rawTotals: Record<string, unknown> | null;
}

/**
 * Parse the AI response into items array and document_totals object.
 * Handles direct JSON objects, markdown code blocks, and legacy bare arrays.
 */
function parseFullResponse(content: string): ParsedResponse {
  const tryExtract = (parsed: unknown): ParsedResponse | null => {
    if (!parsed || typeof parsed !== 'object') return null;

    // Expected shape: { items: [...], document_totals: {...} }
    if (Array.isArray(parsed)) {
      return { rawItems: parsed as Record<string, unknown>[], rawTotals: null };
    }

    const obj = parsed as Record<string, unknown>;

    // Find items array — try "items" key first, then any array value
    let rawItems: Record<string, unknown>[] | null = null;
    if (Array.isArray(obj.items)) {
      rawItems = obj.items as Record<string, unknown>[];
    } else {
      for (const val of Object.values(obj)) {
        if (Array.isArray(val)) {
          rawItems = val as Record<string, unknown>[];
          break;
        }
      }
    }
    if (!rawItems) return null;

    const rawTotals =
      obj.document_totals && typeof obj.document_totals === 'object' && !Array.isArray(obj.document_totals)
        ? (obj.document_totals as Record<string, unknown>)
        : null;

    return { rawItems, rawTotals };
  };

  // 1. Try direct JSON.parse
  try {
    const result = tryExtract(JSON.parse(content));
    if (result) return result;
  } catch {
    // continue
  }

  // 2. Try markdown code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const result = tryExtract(JSON.parse(codeBlockMatch[1].trim()));
      if (result) return result;
    } catch {
      // continue
    }
  }

  // 3. Legacy: try finding a raw JSON array
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return { rawItems: parsed, rawTotals: null };
    } catch {
      // continue
    }
  }

  throw new DocumentProcessorError('Nepodařilo se zpracovat odpověď AI. Vrácená data nejsou ve správném formátu.');
}

/**
 * Normalize raw document_totals object from AI into DocumentTotals.
 */
function normalizeDocumentTotals(raw: Record<string, unknown> | null): DocumentTotals | null {
  if (!raw) return null;
  const total_price = toNumber(raw.total_price);
  const total_vat = toNumber(raw.total_vat);
  const total_price_with_vat = toNumber(raw.total_price_with_vat);
  // Return null if all fields are null (AI found nothing)
  if (total_price === null && total_vat === null && total_price_with_vat === null) return null;
  return { total_price, total_vat, total_price_with_vat };
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
  };
}

/**
 * Fill in missing LineItem fields that can be derived from other present values.
 * Tracks which fields were calculated in derived_fields[].
 */
function deriveLineItemFields(item: LineItem): LineItem {
  const derived: string[] = [];
  let { total_price, unit_price, total_price_with_vat, vat_rate, quantity } = item;

  // total_price from quantity × unit_price
  if (total_price === null && quantity !== null && unit_price !== null) {
    total_price = round2(quantity * unit_price);
    derived.push('total_price');
  }

  // unit_price from total_price ÷ quantity
  if (unit_price === null && total_price !== null && quantity !== null && quantity !== 0) {
    unit_price = round2(total_price / quantity);
    derived.push('unit_price');
  }

  // total_price_with_vat from total_price × (1 + vat_rate/100)
  if (total_price_with_vat === null && total_price !== null && vat_rate !== null) {
    total_price_with_vat = round2(total_price * (1 + vat_rate / 100));
    derived.push('total_price_with_vat');
  }

  // vat_rate from total_price and total_price_with_vat
  if (vat_rate === null && total_price !== null && total_price !== 0 && total_price_with_vat !== null) {
    vat_rate = round2((total_price_with_vat / total_price - 1) * 100);
    derived.push('vat_rate');
  }

  return {
    ...item,
    total_price,
    unit_price,
    total_price_with_vat,
    vat_rate,
    ...(derived.length > 0 ? { derived_fields: derived } : {}),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
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
