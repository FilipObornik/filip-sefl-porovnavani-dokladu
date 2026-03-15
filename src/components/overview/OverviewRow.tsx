import { useRouter } from 'next/router';
import { useAppContext } from '@/state/app-context';
import { ComparisonRow } from '@/state/types';
import FileDropZone from './FileDropZone';
import ValidationCell from '@/components/shared/ValidationCell';
import { processDocument } from '@/services/document-processor';
import { autoMatch } from '@/services/matching-service';

interface OverviewRowProps {
  row: ComparisonRow;
}

export default function OverviewRow({ row }: OverviewRowProps) {
  const { state, dispatch } = useAppContext();
  const router = useRouter();

  const invoice = row.invoiceId
    ? state.invoices.find((d) => d.id === row.invoiceId) ?? null
    : null;
  const receipt = row.receiptId
    ? state.receipts.find((d) => d.id === row.receiptId) ?? null
    : null;

  // Compute totals from ALL document items (not just paired)
  const totalQuantityInvoice =
    row.status === 'done' && invoice
      ? invoice.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
      : null;

  const totalQuantityReceipt =
    row.status === 'done' && receipt
      ? receipt.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
      : null;

  const totalPriceInvoice =
    row.status === 'done' && invoice
      ? invoice.items.reduce((sum, item) => sum + (item.total_price ?? 0), 0)
      : null;

  const totalPriceReceipt =
    row.status === 'done' && receipt
      ? receipt.items.reduce((sum, item) => sum + (item.total_price ?? 0), 0)
      : null;

  const canProcess = row.status === 'ready' || row.status === 'done';
  const isProcessing = row.status === 'processing';
  const isDone = row.status === 'done';

  const handleProcess = async () => {
    if (!invoice || !receipt) return;

    dispatch({ type: 'UPDATE_ROW_STATUS', rowId: row.id, status: 'processing' });
    dispatch({ type: 'UPDATE_DOCUMENT', documentId: invoice.id, updates: { status: 'processing' } });
    dispatch({ type: 'UPDATE_DOCUMENT', documentId: receipt.id, updates: { status: 'processing' } });

    try {
      const [invoiceItems, receiptItems] = await Promise.all([
        processDocument(invoice),
        processDocument(receipt),
      ]);

      dispatch({ type: 'UPDATE_DOCUMENT', documentId: invoice.id, updates: { items: invoiceItems, status: 'done' } });
      dispatch({ type: 'UPDATE_DOCUMENT', documentId: receipt.id, updates: { items: receiptItems, status: 'done' } });

      const pairs = await autoMatch(invoiceItems, receiptItems);
      dispatch({ type: 'SET_MATCHING_PAIRS', rowId: row.id, pairs });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Neznámá chyba';
      dispatch({ type: 'UPDATE_DOCUMENT', documentId: invoice.id, updates: { status: 'error', error: msg } });
      dispatch({ type: 'UPDATE_DOCUMENT', documentId: receipt.id, updates: { status: 'error', error: msg } });
      dispatch({ type: 'UPDATE_ROW_STATUS', rowId: row.id, status: 'error' });
      alert(`Chyba při zpracování: ${msg}`);
    }
  };

  const handleDetail = () => {
    router.push(`/detail/${row.id}`);
  };

  const handleRemove = () => {
    dispatch({ type: 'REMOVE_ROW', rowId: row.id });
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_ROW_NOTE', rowId: row.id, note: e.target.value });
  };

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      {/* Poznamka */}
      <td className="px-2 py-1">
        <input
          type="text"
          value={row.note}
          onChange={handleNoteChange}
          placeholder="Poznámka..."
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
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
          {isProcessing ? 'Zpracovávám...' : 'Zpracuj'}
        </button>
      </td>

      {/* Mnozstvi (quantity) */}
      <ValidationCell
        invoiceValue={totalQuantityInvoice}
        receiptValue={totalQuantityReceipt}
        tolerance={0}
      />

      {/* Celkova cena (total price) */}
      <ValidationCell
        invoiceValue={totalPriceInvoice}
        receiptValue={totalPriceReceipt}
        tolerance={5}
      />

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
          className="text-red-500 hover:text-red-700 font-bold text-lg leading-none px-1"
          title="Smazat řádek"
        >
          &times;
        </button>
      </td>
    </tr>
  );
}
