import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAppContext } from '@/state/app-context';
import { compareDocuments } from '@/services/comparison-service';
import { formatCzechNumber } from '@/lib/number-utils';
import DetailLayout from '@/components/detail/DetailLayout';

export default function DetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { state } = useAppContext();

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
    return compareDocuments(invoiceDoc.items, receiptDoc.items);
  }, [invoiceDoc, receiptDoc]);

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors border border-gray-300"
              >
                &larr; Zpět
              </button>
              <h1 className="text-lg font-bold text-gray-800">
                {row.note || 'Detail porovnání'}
              </h1>
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
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  comparison.checksumValid
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {comparison.checksumValid ? 'Vše OK' : 'Neshoda'}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-4">
        <DetailLayout
          row={row}
          invoiceDoc={invoiceDoc}
          receiptDoc={receiptDoc}
        />
      </main>
    </div>
  );
}

function SummaryBadge({
  label,
  invoiceVal,
  receiptVal,
  valid,
  suffix,
}: {
  label: string;
  invoiceVal: number;
  receiptVal: number;
  valid: boolean;
  suffix?: string;
}) {
  const colorClass = valid ? 'text-green-700' : 'text-red-700';
  const bgClass = valid ? 'bg-green-50' : 'bg-red-50';
  const borderClass = valid ? 'border-green-200' : 'border-red-200';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded border ${bgClass} ${borderClass}`}
    >
      <span className="text-gray-600 font-medium">{label}:</span>
      <span className={`font-medium ${colorClass}`}>
        {formatCzechNumber(invoiceVal)} / {formatCzechNumber(receiptVal)}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  );
}
