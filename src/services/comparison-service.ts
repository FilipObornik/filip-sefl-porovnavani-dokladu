import { Document, LineItem, MatchingPair, VERIFY_TOLERANCE, VerifyStatus } from '../state/types';

/**
 * Compare a document's calculated item totals against the stated document totals.
 * Returns null if the document has no stated totals to compare against.
 */
export function docTotalsMatch(doc: Document, calcPrice: number, calcVat: number, calcWithVat: number, tolerance = VERIFY_TOLERANCE): VerifyStatus {
  const t = doc.documentTotals;
  if (!t) return null;
  if (t.total_price === null && t.total_vat === null && t.total_price_with_vat === null) return null;

  const diffs = [
    t.total_price !== null ? Math.abs(calcPrice - t.total_price) : null,
    t.total_vat !== null ? Math.abs(calcVat - t.total_vat) : null,
    t.total_price_with_vat !== null ? Math.abs(calcWithVat - t.total_price_with_vat) : null,
  ].filter((d): d is number => d !== null);

  if (diffs.some((d) => d > tolerance)) return 'error';
  if (diffs.some((d) => d > 0)) return 'tolerance';
  return 'ok';
}


export interface DocumentComparison {
  totalQuantityInvoice: number;
  totalQuantityReceipt: number;
  quantityValid: boolean;
  totalPriceInvoice: number;
  totalPriceReceipt: number;
  priceValid: boolean;
  totalVatInvoice: number;
  totalVatReceipt: number;
  vatValid: boolean;
  totalPriceWithVatInvoice: number;
  totalPriceWithVatReceipt: number;
  priceWithVatValid: boolean;
  checksumValid: boolean;
}

export interface RowComparison {
  totalQuantityInvoice: number;
  totalQuantityReceipt: number;
  quantityDiff: number;
  quantityValid: boolean;       // diff === 0
  totalPriceInvoice: number;
  totalPriceReceipt: number;
  priceDiff: number;
  priceValid: boolean;          // abs(diff) <= 5
  totalVatInvoice: number;
  totalVatReceipt: number;
  vatDiff: number;
  vatValid: boolean;            // abs(diff) <= 5
  checksumValid: boolean;       // all valid
}

/**
 * Compare all matching pairs in a row and produce aggregated comparison metrics.
 *
 * Validation rules:
 * - Quantity (MJ): must match exactly (tolerance = 0)
 * - Price: +/- 5 CZK tolerance
 * - VAT: +/- 5 CZK tolerance
 */
export function compareRow(pairs: MatchingPair[], invoiceItems: LineItem[], receiptItems: LineItem[], priceTolerance = 5): RowComparison {
  const invoiceMap = new Map(invoiceItems.map((i) => [i.id, i]));
  const receiptMap = new Map(receiptItems.map((i) => [i.id, i]));

  let totalQuantityInvoice = 0;
  let totalQuantityReceipt = 0;
  let totalPriceInvoice = 0;
  let totalPriceReceipt = 0;
  let totalVatInvoice = 0;
  let totalVatReceipt = 0;

  for (const pair of pairs) {
    for (const id of pair.invoiceItemIds) {
      const item = invoiceMap.get(id);
      if (!item) continue;
      totalQuantityInvoice += item.quantity ?? 0;
      totalPriceInvoice += item.total_price ?? 0;
      totalVatInvoice += (item.total_price_with_vat ?? 0) - (item.total_price ?? 0);
    }
    for (const id of pair.receiptItemIds) {
      const item = receiptMap.get(id);
      if (!item) continue;
      totalQuantityReceipt += item.quantity ?? 0;
      totalPriceReceipt += item.total_price ?? 0;
      totalVatReceipt += (item.total_price_with_vat ?? 0) - (item.total_price ?? 0);
    }
  }

  const quantityDiff = totalQuantityInvoice - totalQuantityReceipt;
  const priceDiff = totalPriceInvoice - totalPriceReceipt;
  const vatDiff = totalVatInvoice - totalVatReceipt;

  const quantityValid = quantityDiff === 0;
  const priceValid = Math.abs(priceDiff) <= priceTolerance;
  const vatValid = Math.abs(vatDiff) <= priceTolerance;
  const checksumValid = quantityValid && priceValid && vatValid;

  return {
    totalQuantityInvoice,
    totalQuantityReceipt,
    quantityDiff,
    quantityValid,
    totalPriceInvoice,
    totalPriceReceipt,
    priceDiff,
    priceValid,
    totalVatInvoice,
    totalVatReceipt,
    vatDiff,
    vatValid,
    checksumValid,
  };
}

/**
 * Compare ALL items from invoice and receipt documents.
 * Sums from the full LineItem[] arrays (not just paired items).
 */
export function compareDocuments(
  invoiceItems: LineItem[],
  receiptItems: LineItem[],
  priceTolerance = 5,
): DocumentComparison {
  let totalQuantityInvoice = 0;
  let totalPriceInvoice = 0;
  let totalVatInvoice = 0;
  let totalPriceWithVatInvoice = 0;

  for (const item of invoiceItems) {
    totalQuantityInvoice += item.quantity ?? 0;
    totalPriceInvoice += item.total_price ?? 0;
    const withVat = item.total_price_with_vat ?? 0;
    totalPriceWithVatInvoice += withVat;
    totalVatInvoice += withVat - (item.total_price ?? 0);
  }

  let totalQuantityReceipt = 0;
  let totalPriceReceipt = 0;
  let totalVatReceipt = 0;
  let totalPriceWithVatReceipt = 0;

  for (const item of receiptItems) {
    totalQuantityReceipt += item.quantity ?? 0;
    totalPriceReceipt += item.total_price ?? 0;
    const withVat = item.total_price_with_vat ?? 0;
    totalPriceWithVatReceipt += withVat;
    totalVatReceipt += withVat - (item.total_price ?? 0);
  }

  const quantityValid = totalQuantityInvoice - totalQuantityReceipt === 0;
  const priceValid = Math.abs(totalPriceInvoice - totalPriceReceipt) <= priceTolerance;
  const vatValid = Math.abs(totalVatInvoice - totalVatReceipt) <= priceTolerance;
  const priceWithVatValid =
    Math.abs(totalPriceWithVatInvoice - totalPriceWithVatReceipt) <= priceTolerance;
  const checksumValid =
    quantityValid && priceValid && vatValid && priceWithVatValid;

  return {
    totalQuantityInvoice,
    totalQuantityReceipt,
    quantityValid,
    totalPriceInvoice,
    totalPriceReceipt,
    priceValid,
    totalVatInvoice,
    totalVatReceipt,
    vatValid,
    totalPriceWithVatInvoice,
    totalPriceWithVatReceipt,
    priceWithVatValid,
    checksumValid,
  };
}
