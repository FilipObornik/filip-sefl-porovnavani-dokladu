import { Document, MatchingPair, VERIFY_TOLERANCE } from '@/state/types';
import { DocumentComparison } from '@/services/comparison-service';

export interface RowStatus {
  warnings: string[];
  isHardError: boolean;
}

/**
 * Compute warnings and error severity for a comparison row.
 *
 * isHardError (✗) = celková cena nebo DPH faktury vs příjemky nesedí
 * warnings only (⚠) = vše ostatní (archivované, upravené, nespárované, neshody v párech, součet vs hlavička)
 */
export function computeRowStatus(
  invoiceDoc: Document,
  receiptDoc: Document,
  matchingPairs: MatchingPair[],
  comparison: DocumentComparison,
  tolerances?: { item: number; extraction: number },
): RowStatus {
  const toleranceItem = tolerances?.item ?? 5;
  const toleranceExtraction = tolerances?.extraction ?? VERIFY_TOLERANCE;
  const warnings: string[] = [];

  const archivedInvoice = invoiceDoc.items.filter((i) => i.archived).length;
  const archivedReceipt = receiptDoc.items.filter((i) => i.archived).length;
  if (archivedInvoice > 0) warnings.push(`Archivované položky na faktuře: ${archivedInvoice}`);
  if (archivedReceipt > 0) warnings.push(`Archivované položky na příjemce: ${archivedReceipt}`);

  const editedInvoice = invoiceDoc.items.filter((i) => (i.edited_fields ?? []).length > 0).length;
  const editedReceipt = receiptDoc.items.filter((i) => (i.edited_fields ?? []).length > 0).length;
  if (editedInvoice + editedReceipt > 0) warnings.push(`Ručně upravené položky: ${editedInvoice + editedReceipt}`);

  const pairedInvoiceIds = new Set(matchingPairs.flatMap((p) => p.invoiceItemIds));
  const pairedReceiptIds = new Set(matchingPairs.flatMap((p) => p.receiptItemIds));
  const unpaidInvoice = invoiceDoc.items.filter((i) => !i.archived && !pairedInvoiceIds.has(i.id)).length;
  const unpaidReceipt = receiptDoc.items.filter((i) => !i.archived && !pairedReceiptIds.has(i.id)).length;
  if (unpaidInvoice > 0) warnings.push(`Nespárované položky na faktuře: ${unpaidInvoice}`);
  if (unpaidReceipt > 0) warnings.push(`Nespárované položky na příjemce: ${unpaidReceipt}`);

  let qtyMismatch = 0;
  let priceMismatch = 0;
  for (const pair of matchingPairs) {
    const invItems = invoiceDoc.items.filter((i) => !i.archived && pair.invoiceItemIds.includes(i.id));
    const recItems = receiptDoc.items.filter((i) => !i.archived && pair.receiptItemIds.includes(i.id));
    if (invItems.length > 0 && recItems.length > 0) {
      const invQty = invItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
      const recQty = recItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
      if (invQty !== recQty) qtyMismatch++;
      const invPrice = invItems.reduce((s, i) => s + (i.total_price ?? 0), 0);
      const recPrice = recItems.reduce((s, i) => s + (i.total_price ?? 0), 0);
      if (Math.abs(invPrice - recPrice) > toleranceItem) priceMismatch++;
    }
  }
  if (qtyMismatch > 0) warnings.push(`Nesedící množství: ${qtyMismatch} ${qtyMismatch === 1 ? 'pár' : qtyMismatch < 5 ? 'páry' : 'párů'}`);
  if (priceMismatch > 0) warnings.push(`Nesedící cena v párech: ${priceMismatch} ${priceMismatch === 1 ? 'pár' : priceMismatch < 5 ? 'páry' : 'párů'}`);

  if (!comparison.priceValid) warnings.push('Celková cena faktury a příjemky nesedí');
  if (!comparison.vatValid) warnings.push('Celkové DPH faktury a příjemky nesedí');

  // Součet nearchivovaných položek vs hlavička dokladu — jen ⚠, ne ✗
  const totalPriceInvoice = invoiceDoc.items
    .filter((i) => !i.archived)
    .reduce((s, i) => s + (i.total_price ?? 0), 0);
  const totalPriceReceipt = receiptDoc.items
    .filter((i) => !i.archived)
    .reduce((s, i) => s + (i.total_price ?? 0), 0);
  if (
    invoiceDoc.documentTotals?.total_price != null &&
    Math.abs(totalPriceInvoice - invoiceDoc.documentTotals.total_price) > toleranceExtraction
  ) {
    warnings.push('Součet položek neodpovídá hlavičce faktury');
  }
  if (
    receiptDoc.documentTotals?.total_price != null &&
    Math.abs(totalPriceReceipt - receiptDoc.documentTotals.total_price) > toleranceExtraction
  ) {
    warnings.push('Součet položek neodpovídá hlavičce příjemky');
  }

  return {
    warnings,
    isHardError: !comparison.priceValid || !comparison.vatValid,
  };
}
