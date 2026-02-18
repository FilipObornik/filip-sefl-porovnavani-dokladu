import { LineItem, MatchingPair } from '../state/types';

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
export function compareRow(pairs: MatchingPair[]): RowComparison {
  let totalQuantityInvoice = 0;
  let totalQuantityReceipt = 0;
  let totalPriceInvoice = 0;
  let totalPriceReceipt = 0;
  let totalVatInvoice = 0;
  let totalVatReceipt = 0;

  for (const pair of pairs) {
    // Quantity
    totalQuantityInvoice += pair.invoiceItem?.quantity ?? 0;
    totalQuantityReceipt += pair.receiptItem?.quantity ?? 0;

    // Price (total_price without VAT)
    totalPriceInvoice += pair.invoiceItem?.total_price ?? 0;
    totalPriceReceipt += pair.receiptItem?.total_price ?? 0;

    // VAT = total_price_with_vat - total_price
    const invoiceVat = (pair.invoiceItem?.total_price_with_vat ?? 0) - (pair.invoiceItem?.total_price ?? 0);
    const receiptVat = (pair.receiptItem?.total_price_with_vat ?? 0) - (pair.receiptItem?.total_price ?? 0);
    totalVatInvoice += invoiceVat;
    totalVatReceipt += receiptVat;
  }

  const quantityDiff = totalQuantityInvoice - totalQuantityReceipt;
  const priceDiff = totalPriceInvoice - totalPriceReceipt;
  const vatDiff = totalVatInvoice - totalVatReceipt;

  const quantityValid = quantityDiff === 0;
  const priceValid = Math.abs(priceDiff) <= 5;
  const vatValid = Math.abs(vatDiff) <= 5;
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
  const priceValid = Math.abs(totalPriceInvoice - totalPriceReceipt) <= 5;
  const vatValid = Math.abs(totalVatInvoice - totalVatReceipt) <= 5;
  const priceWithVatValid =
    Math.abs(totalPriceWithVatInvoice - totalPriceWithVatReceipt) <= 5;
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
