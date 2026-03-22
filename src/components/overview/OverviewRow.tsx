import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useAppContext } from '@/state/app-context';
import { ComparisonRow, VERIFY_TOLERANCE } from '@/state/types';
import FileDropZone from './FileDropZone';
import { processDocument } from '@/services/document-processor';
import { autoMatch } from '@/services/matching-service';
import { formatCzechNumber } from '@/lib/number-utils';

interface OverviewRowProps {
  row: ComparisonRow;
}

export default function OverviewRow({ row }: OverviewRowProps) {
  const { state, dispatch } = useAppContext();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReprocess, setConfirmReprocess] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const showTooltip = () => {
    if (!statusBtnRef.current) return;
    const rect = statusBtnRef.current.getBoundingClientRect();
    setTooltipPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
  };

  const hideTooltip = () => setTooltipPos(null);

  const invoice = row.invoiceId
    ? state.invoices.find((d) => d.id === row.invoiceId) ?? null
    : null;
  const receipt = row.receiptId
    ? state.receipts.find((d) => d.id === row.receiptId) ?? null
    : null;

  // Compute totals from ALL document items (not just paired), excluding archived
  const totalPriceInvoice =
    row.status === 'done' && invoice
      ? invoice.items.filter((i) => !i.archived).reduce((sum, item) => sum + (item.total_price ?? 0), 0)
      : null;

  const totalPriceReceipt =
    row.status === 'done' && receipt
      ? receipt.items.filter((i) => !i.archived).reduce((sum, item) => sum + (item.total_price ?? 0), 0)
      : null;

  const totalVatInvoice =
    row.status === 'done' && invoice
      ? invoice.items.filter((i) => !i.archived).reduce((sum, item) => {
          const vat =
            item.total_price_with_vat !== null && item.total_price !== null
              ? item.total_price_with_vat - item.total_price
              : 0;
          return sum + vat;
        }, 0)
      : null;

  const totalVatReceipt =
    row.status === 'done' && receipt
      ? receipt.items.filter((i) => !i.archived).reduce((sum, item) => {
          const vat =
            item.total_price_with_vat !== null && item.total_price !== null
              ? item.total_price_with_vat - item.total_price
              : 0;
          return sum + vat;
        }, 0)
      : null;

  const documentClosed =
    row.status === 'done' && receipt
      ? receipt.documentClosed
      : null;

  const priceOk =
    totalPriceInvoice !== null && totalPriceReceipt !== null
      ? Math.abs(totalPriceInvoice - totalPriceReceipt) <= 5
      : null;

  const vatOk =
    totalVatInvoice !== null && totalVatReceipt !== null
      ? Math.abs(totalVatInvoice - totalVatReceipt) <= 5
      : null;

  // Item counts (non-archived)
  const invoiceItemCount = invoice ? invoice.items.filter((i) => !i.archived).length : null;
  const receiptItemCount = receipt ? receipt.items.filter((i) => !i.archived).length : null;

  // Document-level verify: does sum of items match header totals?
  const invoiceVerifyOk =
    row.status === 'done' && invoice && totalPriceInvoice !== null &&
    invoice.documentTotals?.total_price !== null && invoice.documentTotals?.total_price !== undefined
      ? Math.abs(totalPriceInvoice - invoice.documentTotals.total_price) <= VERIFY_TOLERANCE
      : null;

  const receiptVerifyOk =
    row.status === 'done' && receipt && totalPriceReceipt !== null &&
    receipt.documentTotals?.total_price !== null && receipt.documentTotals?.total_price !== undefined
      ? Math.abs(totalPriceReceipt - receipt.documentTotals.total_price) <= VERIFY_TOLERANCE
      : null;

  const verifyFail = invoiceVerifyOk === false || receiptVerifyOk === false;
  const verifyOk = !verifyFail && (invoiceVerifyOk === true || receiptVerifyOk === true);

  // Compute status warnings
  const warnings: string[] = [];
  if (row.status === 'done' && invoice && receipt) {
    // Archived items
    const archivedInvoice = invoice.items.filter((i) => i.archived).length;
    const archivedReceipt = receipt.items.filter((i) => i.archived).length;
    if (archivedInvoice > 0) warnings.push(`Archivované položky na faktuře: ${archivedInvoice}`);
    if (archivedReceipt > 0) warnings.push(`Archivované položky na příjemce: ${archivedReceipt}`);

    // Manually edited items
    const editedInvoice = invoice.items.filter((i) => (i.edited_fields ?? []).length > 0).length;
    const editedReceipt = receipt.items.filter((i) => (i.edited_fields ?? []).length > 0).length;
    const totalEdited = editedInvoice + editedReceipt;
    if (totalEdited > 0) warnings.push(`Ručně upravené položky: ${totalEdited}`);

    // Unmatched items
    const pairedInvoiceIds = new Set(row.matchingPairs.flatMap((p) => p.invoiceItemIds));
    const pairedReceiptIds = new Set(row.matchingPairs.flatMap((p) => p.receiptItemIds));
    const unpaidInvoice = invoice.items.filter((i) => !i.archived && !pairedInvoiceIds.has(i.id)).length;
    const unpaidReceipt = receipt.items.filter((i) => !i.archived && !pairedReceiptIds.has(i.id)).length;
    if (unpaidInvoice > 0) warnings.push(`Nespárované položky na faktuře: ${unpaidInvoice}`);
    if (unpaidReceipt > 0) warnings.push(`Nespárované položky na příjemce: ${unpaidReceipt}`);

    // Qty / price mismatches per pair
    let qtyMismatch = 0;
    let priceMismatch = 0;
    for (const pair of row.matchingPairs) {
      const invItems = invoice.items.filter((i) => !i.archived && pair.invoiceItemIds.includes(i.id));
      const recItems = receipt.items.filter((i) => !i.archived && pair.receiptItemIds.includes(i.id));
      if (invItems.length > 0 && recItems.length > 0) {
        const invQty = invItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
        const recQty = recItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
        if (invQty !== recQty) qtyMismatch++;
        const invPrice = invItems.reduce((s, i) => s + (i.total_price ?? 0), 0);
        const recPrice = recItems.reduce((s, i) => s + (i.total_price ?? 0), 0);
        if (Math.abs(invPrice - recPrice) > 5) priceMismatch++;
      }
    }
    if (qtyMismatch > 0) warnings.push(`Nesedící množství: ${qtyMismatch} ${qtyMismatch === 1 ? 'pár' : qtyMismatch < 5 ? 'páry' : 'párů'}`);
    if (priceMismatch > 0) warnings.push(`Nesedící cena v párech: ${priceMismatch} ${priceMismatch === 1 ? 'pár' : priceMismatch < 5 ? 'páry' : 'párů'}`);
    if (priceOk === false) warnings.push('Celková cena faktury a příjemky nesedí');
    if (vatOk === false) warnings.push('Celkové DPH faktury a příjemky nesedí');
  }

  const canProcess = row.status === 'ready' || row.status === 'done';
  const isProcessing = row.status === 'processing';
  const isDone = row.status === 'done';

  const handleProcess = async () => {
    if (!invoice || !receipt) return;
    if (isDone) {
      setConfirmReprocess(true);
      return;
    }
    await doProcess();
  };

  const doProcess = async () => {
    if (!invoice || !receipt) return;

    dispatch({ type: 'UPDATE_ROW_STATUS', rowId: row.id, status: 'processing' });
    dispatch({ type: 'UPDATE_DOCUMENT', documentId: invoice.id, updates: { status: 'processing' } });
    dispatch({ type: 'UPDATE_DOCUMENT', documentId: receipt.id, updates: { status: 'processing' } });

    try {
      const [invoiceResult, receiptResult] = await Promise.all([
        processDocument(invoice),
        processDocument(receipt),
      ]);

      dispatch({ type: 'UPDATE_DOCUMENT', documentId: invoice.id, updates: { items: invoiceResult.items, status: 'done', documentTotals: invoiceResult.documentTotals ?? undefined, documentClosed: invoiceResult.documentClosed } });
      dispatch({ type: 'UPDATE_DOCUMENT', documentId: receipt.id, updates: { items: receiptResult.items, status: 'done', documentTotals: receiptResult.documentTotals ?? undefined, documentClosed: receiptResult.documentClosed } });

      const pairs = await autoMatch(invoiceResult.items, receiptResult.items);
      dispatch({ type: 'SET_MATCHING_PAIRS', rowId: row.id, pairs });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Neznámá chyba';
      dispatch({ type: 'UPDATE_DOCUMENT', documentId: invoice.id, updates: { status: 'error', error: msg } });
      dispatch({ type: 'UPDATE_DOCUMENT', documentId: receipt.id, updates: { status: 'error', error: msg } });
      dispatch({ type: 'UPDATE_ROW_STATUS', rowId: row.id, status: 'error' });
    }
  };

  const handleDetail = () => {
    router.push(`/detail/${row.id}`);
  };

  const handleRemove = () => {
    setConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    dispatch({ type: 'REMOVE_ROW', rowId: row.id });
    setConfirmDelete(false);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: 'UPDATE_ROW_NOTE', rowId: row.id, note: e.target.value });
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  // Sync textarea height when note changes externally (e.g. load)
  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto';
      noteRef.current.style.height = noteRef.current.scrollHeight + 'px';
    }
  }, [row.note]);

  const errorMessage = invoice?.error ?? receipt?.error ?? null;

  return (
    <>
    {confirmDelete && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
          <h2 className="text-base font-semibold text-gray-800 mb-2">Smazat řádek?</h2>
          <p className="text-sm text-gray-600 mb-5">
            Tato akce je nevratná. Budou smazány i nahrané dokumenty a napárované položky.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Zrušit
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 font-medium"
            >
              Smazat
            </button>
          </div>
        </div>
      </div>
    )}
    {confirmReprocess && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
          <h2 className="text-base font-semibold text-gray-800 mb-2">Znovu vytěžit doklady?</h2>
          <p className="text-sm text-gray-600 mb-5">
            Vytěžení již proběhlo. Opětovným zpracováním dojde k přegenerování výsledků a předchozí vytěžení bude zahozeno.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmReprocess(false)}
              className="px-4 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Zrušit
            </button>
            <button
              onClick={() => { setConfirmReprocess(false); doProcess(); }}
              className="px-4 py-1.5 text-sm rounded bg-amber-600 text-white hover:bg-amber-700 font-medium"
            >
              Zpracovat znovu
            </button>
          </div>
        </div>
      </div>
    )}
    {row.status === 'error' && errorMessage && (
      <tr className="bg-red-50 border-b border-red-200">
        <td colSpan={13} className="px-3 py-1.5 text-sm text-red-700">
          <span className="font-medium">Chyba při zpracování:</span> {errorMessage}
        </td>
      </tr>
    )}
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      {/* Poznamka */}
      <td className="px-2 py-1 align-top">
        <textarea
          ref={noteRef}
          value={row.note}
          onChange={handleNoteChange}
          placeholder="Poznámka..."
          rows={1}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none overflow-y-auto"
          style={{ minHeight: '30px', maxHeight: '113px' }}
        />
      </td>

      {/* Faktura (invoice) */}
      <FileDropZone
        side="invoice"
        rowId={row.id}
        document={invoice}
        className="bg-sky-100"
      />

      {/* Prijemka (receipt) */}
      <FileDropZone
        side="receipt"
        rowId={row.id}
        document={receipt}
        className="bg-emerald-100"
      />

      {/* Zpracuj button */}
      <td className="px-2 py-1 text-center">
        <button
          onClick={handleProcess}
          disabled={!canProcess || isProcessing}
          className={`
            px-3 py-1 text-sm rounded font-medium transition-colors
            ${
              canProcess && !isProcessing
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isProcessing ? 'Počkej' : 'Zpracuj'}
        </button>
      </td>

      {/* Cena faktura / prijemka */}
      <td className="px-3 py-2 text-center text-sm whitespace-nowrap">
        {totalPriceInvoice !== null && totalPriceReceipt !== null ? (
          <span className={priceOk ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
            {formatCzechNumber(totalPriceInvoice)} / {formatCzechNumber(totalPriceReceipt)}
          </span>
        ) : totalPriceInvoice !== null ? (
          <span className="text-gray-500">{formatCzechNumber(totalPriceInvoice)} / –</span>
        ) : '–'}
      </td>

      {/* DPH — jen ✓/✗ */}
      <td className="px-3 py-2 text-center text-sm">
        {vatOk === null ? (
          <span className="text-gray-400">–</span>
        ) : vatOk ? (
          <span className="text-green-700 font-bold">✓</span>
        ) : (
          <span className="text-red-700 font-bold">✗</span>
        )}
      </td>

      {/* MJ: počet položek příjemky / faktury */}
      <td className="px-3 py-2 text-center text-sm whitespace-nowrap">
        {receiptItemCount !== null && invoiceItemCount !== null ? (
          <span className={receiptItemCount === invoiceItemCount ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
            {receiptItemCount}/{invoiceItemCount}
          </span>
        ) : (
          <span className="text-gray-400">–</span>
        )}
      </td>

      {/* Verify: součet položek vs hlavička dokumentu */}
      <td className="px-3 py-2 text-center text-sm">
        {invoiceVerifyOk === null && receiptVerifyOk === null ? (
          <span className="text-gray-400">–</span>
        ) : verifyFail ? (
          <span className="text-red-700 font-bold">✗</span>
        ) : verifyOk ? (
          <span className="text-green-700 font-bold">✓</span>
        ) : (
          <span className="text-gray-400">–</span>
        )}
      </td>

      {/* Doklad uzavren */}
      <td className="px-3 py-2 text-center text-sm whitespace-nowrap">
        {documentClosed === null ? (
          <span className="text-gray-400">–</span>
        ) : documentClosed ? (
          <span className="text-green-700 font-bold">✓</span>
        ) : (
          <span className="text-red-700 font-bold">✗</span>
        )}
      </td>

      {/* Stav */}
      <td className="px-3 py-2 text-center text-sm">
        {row.status === 'done' && (
          warnings.length === 0 ? (
            <span className="text-green-600 text-base font-bold">✓</span>
          ) : (
            <>
              <button
                ref={statusBtnRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onClick={() => tooltipPos ? hideTooltip() : showTooltip()}
                className={(priceOk === false || vatOk === false)
                  ? 'text-red-600 text-base font-bold hover:opacity-70'
                  : 'text-amber-500 text-base font-bold hover:opacity-70'
                }
              >
                {(priceOk === false || vatOk === false) ? '✗' : '⚠'}
              </button>
              {tooltipPos && typeof document !== 'undefined' && ReactDOM.createPortal(
                <div
                  className="fixed z-[9999] w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left pointer-events-none"
                  style={{ top: tooltipPos.top, left: tooltipPos.left, transform: 'translateX(-50%)' }}
                >
                  <p className="text-xs font-semibold text-gray-600 mb-2">Upozornění:</p>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <span className="mt-0.5 shrink-0 text-amber-500">•</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>,
                document.body
              )}
            </>
          )
        )}
      </td>

      {/* Detail button */}
      <td className="px-2 py-1 text-center">
        <button
          onClick={handleDetail}
          disabled={!isDone}
          className={`
            px-3 py-1 text-sm rounded font-medium transition-colors
            ${
              isDone
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Detail
        </button>
      </td>

      {/* Smazat (delete) button */}
      <td className="px-2 py-1 text-center">
        <button
          onClick={handleRemove}
          className="text-red-400 hover:text-red-600 transition-colors px-1"
          title="Smazat řádek"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </td>
    </tr>
    </>
  );
}
