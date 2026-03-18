import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Document, LineItem, VERIFY_TOLERANCE } from '@/state/types';
import { useAppContext } from '@/state/app-context';
import { formatCzechNumber, parseCzechNumber } from '@/lib/number-utils';
import InlineEditable from './InlineEditable';

interface DocumentVerifyModalProps {
  document: Document;
  onClose: () => void;
}

export default function DocumentVerifyModal({ document: doc, onClose }: DocumentVerifyModalProps) {
  const { dispatch } = useAppContext();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleFieldEdit = (item: LineItem, field: keyof LineItem, value: string) => {
    let parsedValue: string | number | boolean | null = value;
    if (['quantity', 'unit_price', 'total_price', 'total_price_with_vat', 'vat_rate'].includes(field)) {
      parsedValue = parseCzechNumber(value);
    }
    // Manual edit clears derived flag and adds to edited_fields
    const derived_fields = (item.derived_fields ?? []).filter((f) => f !== field);
    const edited_fields = Array.from(new Set([...(item.edited_fields ?? []), field as string]));
    dispatch({
      type: 'UPDATE_LINE_ITEM',
      documentId: doc.id,
      itemId: item.id,
      updates: { [field]: parsedValue, derived_fields, edited_fields },
    });
  };

  const isDerived = (item: LineItem, field: string) =>
    (item.derived_fields ?? []).includes(field);

  const isEdited = (item: LineItem, field: string) =>
    (item.edited_fields ?? []).includes(field);

  const isImage = doc.mimeType.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';
  const dataUri = `data:${doc.mimeType};base64,${doc.rawData}`;

  const typeLabel = doc.type === 'invoice' ? 'Faktura' : 'Příjemka';
  const headerColor = doc.type === 'invoice' ? 'bg-blue-600' : 'bg-green-600';

  // Summaries
  const totalQuantity = doc.items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
  const totalPrice = doc.items.reduce((sum, i) => sum + (i.total_price ?? 0), 0);
  const totalVat = doc.items.reduce((sum, i) => {
    const withVat = i.total_price_with_vat ?? 0;
    const without = i.total_price ?? 0;
    return sum + (withVat - without);
  }, 0);
  const totalWithVat = doc.items.reduce((sum, i) => sum + (i.total_price_with_vat ?? 0), 0);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-[95vw] h-[92vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`${headerColor} text-white px-5 py-3 flex items-center justify-between shrink-0`}>
          <div>
            <h2 className="text-lg font-semibold">{doc.name}</h2>
            <span className="text-sm opacity-80">{typeLabel}</span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content: two columns */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Document preview */}
          <div className="w-1/2 border-r border-gray-200 overflow-auto bg-gray-100 flex items-start justify-center p-4">
            {isImage && (
              <img
                src={dataUri}
                alt={doc.name}
                className="max-w-full h-auto shadow-md"
              />
            )}
            {isPdf && (
              <iframe
                src={dataUri}
                title={doc.name}
                className="w-full h-full border-0"
              />
            )}
            {!isImage && !isPdf && (
              <div className="text-gray-500 text-sm italic mt-10">
                Náhled není dostupný pro tento typ souboru ({doc.mimeType})
              </div>
            )}
          </div>

          {/* Right: Extracted items */}
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
              <h3 className="text-sm font-semibold text-gray-700">
                Vytěžené položky ({doc.items.length})
              </h3>
              <div className="flex items-center gap-4 mt-0.5">
                <p className="text-xs text-gray-400">Dvakrát klikněte na hodnotu pro úpravu</p>
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-100 text-amber-600 font-bold text-[10px]">~</span>
                  dopočítáno
                </span>
                <span className="flex items-center gap-1 text-xs text-blue-600">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-600 font-bold text-[10px]">✎</span>
                  ručně upraveno
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Název</th>
                    <th className="px-3 py-2 font-medium">MJ</th>
                    <th className="px-3 py-2 font-medium">Jedn.</th>
                    <th className="px-3 py-2 font-medium">Jedn. cena</th>
                    <th className="px-3 py-2 font-medium">Cena</th>
                    <th className="px-3 py-2 font-medium">S DPH</th>
                    <th className="px-3 py-2 font-medium">DPH %</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">{idx + 1}</td>
                      <td className={`px-3 py-1.5 max-w-[200px] ${isEdited(item, 'item_name') ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-1">
                          <InlineEditable
                            value={item.item_name}
                            onSave={(v) => handleFieldEdit(item, 'item_name', v)}
                            className="text-gray-800 font-medium"
                          />
                          {isEdited(item, 'item_name') && <EditedMark />}
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 ${isDerived(item, 'quantity') ? 'bg-amber-50' : isEdited(item, 'quantity') ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-1">
                          <InlineEditable
                            value={item.quantity !== null ? String(item.quantity) : ''}
                            onSave={(v) => handleFieldEdit(item, 'quantity', v)}
                            className="text-gray-700"
                            displayValue={formatCzechNumber(item.quantity, 2)}
                          />
                          {isDerived(item, 'quantity') && <DerivedMark />}
                          {isEdited(item, 'quantity') && <EditedMark />}
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 ${isEdited(item, 'unit') ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-1">
                          <InlineEditable
                            value={item.unit ?? ''}
                            onSave={(v) => handleFieldEdit(item, 'unit', v)}
                            className="text-gray-500"
                          />
                          {isEdited(item, 'unit') && <EditedMark />}
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 ${isDerived(item, 'unit_price') ? 'bg-amber-50' : isEdited(item, 'unit_price') ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-1">
                          <InlineEditable
                            value={item.unit_price !== null ? String(item.unit_price) : ''}
                            onSave={(v) => handleFieldEdit(item, 'unit_price', v)}
                            className="text-gray-700"
                            displayValue={formatCzechNumber(item.unit_price)}
                          />
                          {isDerived(item, 'unit_price') && <DerivedMark />}
                          {isEdited(item, 'unit_price') && <EditedMark />}
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 ${isDerived(item, 'total_price') ? 'bg-amber-50' : isEdited(item, 'total_price') ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-1">
                          <InlineEditable
                            value={item.total_price !== null ? String(item.total_price) : ''}
                            onSave={(v) => handleFieldEdit(item, 'total_price', v)}
                            className="text-gray-700"
                            displayValue={formatCzechNumber(item.total_price)}
                          />
                          {isDerived(item, 'total_price') && <DerivedMark />}
                          {isEdited(item, 'total_price') && <EditedMark />}
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 ${isDerived(item, 'total_price_with_vat') ? 'bg-amber-50' : isEdited(item, 'total_price_with_vat') ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-1">
                          <InlineEditable
                            value={item.total_price_with_vat !== null ? String(item.total_price_with_vat) : ''}
                            onSave={(v) => handleFieldEdit(item, 'total_price_with_vat', v)}
                            className="text-gray-700"
                            displayValue={formatCzechNumber(item.total_price_with_vat)}
                          />
                          {isDerived(item, 'total_price_with_vat') && <DerivedMark />}
                          {isEdited(item, 'total_price_with_vat') && <EditedMark />}
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 ${isDerived(item, 'vat_rate') ? 'bg-amber-50' : isEdited(item, 'vat_rate') ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-1">
                          <InlineEditable
                            value={item.vat_rate !== null ? String(item.vat_rate) : ''}
                            onSave={(v) => handleFieldEdit(item, 'vat_rate', v)}
                            className="text-gray-700"
                            displayValue={item.vat_rate !== null ? `${formatCzechNumber(item.vat_rate, 0)} %` : '–'}
                          />
                          {isDerived(item, 'vat_rate') && <DerivedMark />}
                          {isEdited(item, 'vat_rate') && <EditedMark />}
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 ${isEdited(item, 'sku') ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-1">
                          <InlineEditable
                            value={item.sku ?? ''}
                            onSave={(v) => handleFieldEdit(item, 'sku', v)}
                            className="text-gray-500"
                          />
                          {isEdited(item, 'sku') && <EditedMark />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 shrink-0 space-y-2">
              {/* Calculated totals (sum of items) */}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Spočítané (součet položek)</p>
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Celkem kusů:</span>
                    <span className="ml-1 font-semibold text-gray-800">{formatCzechNumber(totalQuantity, 2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Cena bez DPH:</span>
                    <span className="ml-1 font-semibold text-gray-800">{formatCzechNumber(totalPrice)} Kč</span>
                  </div>
                  <div>
                    <span className="text-gray-500">DPH:</span>
                    <span className="ml-1 font-semibold text-gray-800">{formatCzechNumber(totalVat)} Kč</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Celkem s DPH:</span>
                    <span className="ml-1 font-semibold text-gray-800">{formatCzechNumber(totalWithVat)} Kč</span>
                  </div>
                </div>
              </div>

              {/* Extracted document totals + verification */}
              {doc.documentTotals && (
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Přečtené z dokladu (verifikace)</p>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <VerifyCell
                      label="Cena bez DPH"
                      calculated={totalPrice}
                      extracted={doc.documentTotals.total_price}
                    />
                    <VerifyCell
                      label="DPH"
                      calculated={totalVat}
                      extracted={doc.documentTotals.total_vat}
                    />
                    <VerifyCell
                      label="Celkem s DPH"
                      calculated={totalWithVat}
                      extracted={doc.documentTotals.total_price_with_vat}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, globalThis.document.body);
}

function DerivedMark() {
  return (
    <span
      title="Dopočítáno z ostatních hodnot"
      className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-100 text-amber-600 font-bold text-[10px] shrink-0 cursor-default"
    >
      ~
    </span>
  );
}

function EditedMark() {
  return (
    <span
      title="Ručně upraveno uživatelem"
      className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-600 font-bold text-[10px] shrink-0 cursor-default"
    >
      ✎
    </span>
  );
}

function VerifyCell({
  label,
  calculated,
  extracted,
}: {
  label: string;
  calculated: number;
  extracted: number | null;
}) {
  if (extracted === null) {
    return (
      <div>
        <span className="text-gray-500">{label}:</span>
        <span className="ml-1 text-gray-400 italic">–</span>
      </div>
    );
  }
  const ok = Math.abs(calculated - extracted) <= VERIFY_TOLERANCE;
  return (
    <div>
      <span className="text-gray-500">{label}:</span>
      <span className={`ml-1 font-semibold ${ok ? 'text-green-700' : 'text-red-700'}`}>
        {formatCzechNumber(extracted)} Kč
      </span>
      <span className={`ml-1 ${ok ? 'text-green-600' : 'text-red-600'}`}>
        {ok ? '✓' : `≠ ${formatCzechNumber(calculated)} Kč`}
      </span>
    </div>
  );
}
