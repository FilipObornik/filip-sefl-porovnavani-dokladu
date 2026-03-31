import { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useAppContext } from '@/state/app-context';
import { compareDocuments, docTotalsMatch } from '@/services/comparison-service';
import { computeRowStatus } from '@/lib/row-status';
import { useSettings } from '@/state/settings-context';
import DetailLayout from '@/components/detail/DetailLayout';
import SummaryBadge from '@/components/detail/SummaryBadge';

export default function DetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { state } = useAppContext();
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  const { settings } = useSettings();
  const row = state.comparisonRows.find((r) => r.id === id);

  const invoiceDoc = useMemo(() => {
    if (!row?.invoiceId) return null;
    return state.invoices.find((d) => d.id === row.invoiceId) ?? null;
  }, [row?.invoiceId, state.invoices]);

  const receiptDoc = useMemo(() => {
    if (!row?.receiptId) return null;
    return state.receipts.find((d) => d.id === row.receiptId) ?? null;
  }, [row?.receiptId, state.receipts]);

  const comparison = useMemo(() => {
    if (!invoiceDoc || !receiptDoc) return null;
    return compareDocuments(
      invoiceDoc.items.filter((i) => !i.archived),
      receiptDoc.items.filter((i) => !i.archived),
      settings.toleranceTotal,
    );
  }, [invoiceDoc, receiptDoc, settings.toleranceTotal]);

  // CalcTotals for display ("Spočítáno") includes ALL items (incl. archived) — for extraction quality check
  const invoiceCalcTotalsAll = useMemo(() => {
    if (!invoiceDoc) return null;
    const all = invoiceDoc.items;
    return {
      price: all.reduce((s, i) => s + (i.total_price ?? 0), 0),
      vat: all.reduce((s, i) => s + ((i.total_price_with_vat ?? 0) - (i.total_price ?? 0)), 0),
      priceWithVat: all.reduce((s, i) => s + (i.total_price_with_vat ?? 0), 0),
    };
  }, [invoiceDoc]);

  const receiptCalcTotalsAll = useMemo(() => {
    if (!receiptDoc) return null;
    const all = receiptDoc.items;
    return {
      price: all.reduce((s, i) => s + (i.total_price ?? 0), 0),
      vat: all.reduce((s, i) => s + ((i.total_price_with_vat ?? 0) - (i.total_price ?? 0)), 0),
      priceWithVat: all.reduce((s, i) => s + (i.total_price_with_vat ?? 0), 0),
    };
  }, [receiptDoc]);

  // Verify (✓/✗ banner) uses same totals as the display (all items incl. archived)
  const invoiceVerify = useMemo(() => {
    if (!invoiceDoc || !invoiceCalcTotalsAll) return null;
    return docTotalsMatch(invoiceDoc, invoiceCalcTotalsAll.price, invoiceCalcTotalsAll.vat, invoiceCalcTotalsAll.priceWithVat, settings.toleranceExtraction);
  }, [invoiceDoc, invoiceCalcTotalsAll, settings.toleranceExtraction]);

  const receiptVerify = useMemo(() => {
    if (!receiptDoc || !receiptCalcTotalsAll) return null;
    return docTotalsMatch(receiptDoc, receiptCalcTotalsAll.price, receiptCalcTotalsAll.vat, receiptCalcTotalsAll.priceWithVat, settings.toleranceExtraction);
  }, [receiptDoc, receiptCalcTotalsAll, settings.toleranceExtraction]);

  const { warnings, isHardError } = useMemo(() => {
    if (!invoiceDoc || !receiptDoc || !comparison || !row) return { warnings: [], isHardError: false };
    return computeRowStatus(invoiceDoc, receiptDoc, row.matchingPairs, comparison, {
      item: settings.toleranceItem,
      extraction: settings.toleranceExtraction,
    });
  }, [invoiceDoc, receiptDoc, comparison, row, settings.toleranceItem, settings.toleranceExtraction]);

  // Redirect if row not found or not done
  useEffect(() => {
    if (!router.isReady) return;
    if (!row || row.status !== 'done') {
      router.replace('/');
    }
  }, [router.isReady, row, router]);

  // Escape key → go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  // Show nothing during redirect
  if (!row || row.status !== 'done' || !invoiceDoc || !receiptDoc) {
    return null;
  }

  const showTooltip = () => {
    if (!statusBtnRef.current) return;
    const rect = statusBtnRef.current.getBoundingClientRect();
    setTooltipPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
  };
  const hideTooltip = () => setTooltipPos(null);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors border border-gray-300"
              >
                &larr; Zpět
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-800">
                  {row.note || 'Detail porovnání'}
                </h1>
              </div>
            </div>
          </div>

          {/* Summary bar */}
          {comparison && (
            <div className="flex items-center gap-6 mt-2 text-sm">
              <SummaryBadge
                label="Celkem kusů"
                invoiceVal={comparison.totalQuantityInvoice}
                receiptVal={comparison.totalQuantityReceipt}
                valid={comparison.quantityValid}
              />
              <SummaryBadge
                label="Cena bez DPH"
                invoiceVal={comparison.totalPriceInvoice}
                receiptVal={comparison.totalPriceReceipt}
                valid={comparison.priceValid}
                suffix="Kč"
              />
              <SummaryBadge
                label="DPH"
                invoiceVal={comparison.totalVatInvoice}
                receiptVal={comparison.totalVatReceipt}
                valid={comparison.vatValid}
                suffix="Kč"
              />
              <SummaryBadge
                label="Cena s DPH"
                invoiceVal={comparison.totalPriceWithVatInvoice}
                receiptVal={comparison.totalPriceWithVatReceipt}
                valid={comparison.priceWithVatValid}
                suffix="Kč"
              />

              {/* Stav — same logic as overview Stav column */}
              {warnings.length === 0 ? (
                <span className="text-green-600 text-base font-bold">✓</span>
              ) : (
                <>
                  <button
                    ref={statusBtnRef}
                    onMouseEnter={showTooltip}
                    onMouseLeave={hideTooltip}
                    onClick={() => tooltipPos ? hideTooltip() : showTooltip()}
                    className={`text-base font-bold hover:opacity-70 ${isHardError ? 'text-red-600' : 'text-amber-500'}`}
                  >
                    {isHardError ? '✗' : '⚠'}
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
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full px-6 py-4 overflow-hidden flex flex-col">
        <DetailLayout
          row={row}
          invoiceDoc={invoiceDoc}
          receiptDoc={receiptDoc}
          invoiceCalcTotals={invoiceCalcTotalsAll}
          receiptCalcTotals={receiptCalcTotalsAll}
          invoiceVerify={invoiceVerify}
          receiptVerify={receiptVerify}
        />
      </main>
    </div>
  );
}


