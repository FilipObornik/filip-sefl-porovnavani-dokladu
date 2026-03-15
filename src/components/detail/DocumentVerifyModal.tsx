import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Document, LineItem } from '@/state/types';
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

  const handleFieldEdit = (itemId: string, field: keyof LineItem, value: string) => {
    let parsedValue: string | number | boolean | null = value;
    if (['quantity', 'unit_price', 'total_price', 'total_price_with_vat', 'vat_rate'].includes(field)) {
      parsedValue = parseCzechNumber(value);
    }
    dispatch({
      type: 'UPDATE_LINE_ITEM',
      documentId: doc.id,
      itemId,
      updates: { [field]: parsedValue },
    });
  };

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
              <p className="text-xs text-gray-400">Dvakrát klikněte na hodnotu pro úpravu</p>
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
                      <td className="px-3 py-1.5 max-w-[200px]">
                        <InlineEditable
                          value={item.item_name}
                          onSave={(v) => handleFieldEdit(item.id, 'item_name', v)}
                          className="text-gray-800 font-medium"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <InlineEditable
                          value={item.quantity !== null ? String(item.quantity) : ''}
                          onSave={(v) => handleFieldEdit(item.id, 'quantity', v)}
                          className="text-gray-700"
                          displayValue={formatCzechNumber(item.quantity, 2)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <InlineEditable
                          value={item.unit ?? ''}
                          onSave={(v) => handleFieldEdit(item.id, 'unit', v)}
                          className="text-gray-500"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <InlineEditable
                          value={item.unit_price !== null ? String(item.unit_price) : ''}
                          onSave={(v) => handleFieldEdit(item.id, 'unit_price', v)}
                          className="text-gray-700"
                          displayValue={formatCzechNumber(item.unit_price)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <InlineEditable
                          value={item.total_price !== null ? String(item.total_price) : ''}
                          onSave={(v) => handleFieldEdit(item.id, 'total_price', v)}
                          className="text-gray-700"
                          displayValue={formatCzechNumber(item.total_price)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <InlineEditable
                          value={item.total_price_with_vat !== null ? String(item.total_price_with_vat) : ''}
                          onSave={(v) => handleFieldEdit(item.id, 'total_price_with_vat', v)}
                          className="text-gray-700"
                          displayValue={formatCzechNumber(item.total_price_with_vat)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <InlineEditable
                          value={item.vat_rate !== null ? String(item.vat_rate) : ''}
                          onSave={(v) => handleFieldEdit(item.id, 'vat_rate', v)}
                          className="text-gray-700"
                          displayValue={item.vat_rate !== null ? `${formatCzechNumber(item.vat_rate, 0)} %` : '–'}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <InlineEditable
                          value={item.sku ?? ''}
                          onSave={(v) => handleFieldEdit(item.id, 'sku', v)}
                          className="text-gray-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 shrink-0">
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
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, globalThis.document.body);
}
