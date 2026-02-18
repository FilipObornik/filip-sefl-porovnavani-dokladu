import { v4 as uuidv4 } from 'uuid';
import { LineItem, MatchingPair } from '../state/types';
import { levenshteinSimilarity } from '../lib/levenshtein';

const SIMILARITY_THRESHOLD = 0.40;

/**
 * Automatically match invoice line items to receipt line items using
 * greedy Levenshtein similarity on item names.
 *
 * Returns a list of MatchingPairs covering all items from both sides:
 * - Matched pairs (invoiceItem + receiptItem)
 * - Unmatched invoice items (receiptItem = null)
 * - Unmatched receipt items (invoiceItem = null)
 */
export function autoMatch(invoiceItems: LineItem[], receiptItems: LineItem[]): MatchingPair[] {
  const pairs: MatchingPair[] = [];

  // Track which receipt items have been consumed
  const usedReceiptIds = new Set<string>();

  // Sort invoice items by item_name length descending (longest/most specific first)
  const sortedInvoice = [...invoiceItems].sort(
    (a, b) => (b.item_name?.length ?? 0) - (a.item_name?.length ?? 0)
  );

  // Greedy matching: for each invoice item, find best available receipt match
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
    // Unmatched items stay in side panels — no single-sided pairs
  }

  return pairs;
}
