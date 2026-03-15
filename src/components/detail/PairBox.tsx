import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MatchingPair, LineItem } from '@/state/types';
import { formatCzechNumber, parseCzechNumber } from '@/lib/number-utils';
import { useAppContext } from '@/state/app-context';
import InlineEditable from './InlineEditable';

interface PairBoxProps {
  pair: MatchingPair;
  onUnpair: (pairId: string, side: 'invoice' | 'receipt') => void;
  rowId: string;
}

function PairDropZone({
  pairId,
  side,
  children,
}: {
  pairId: string;
  side: 'invoice' | 'receipt';
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `pair::${pairId}::${side}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[80px] p-2 rounded transition-colors ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-300' : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function PairBox({ pair, onUnpair, rowId }: PairBoxProps) {
  const { dispatch } = useAppContext();
  const inv = pair.invoiceItem;
  const rec = pair.receiptItem;

  // Quantity validation: exact match
  const bothHaveQuantity =
    inv?.quantity !== null &&
    inv?.quantity !== undefined &&
    rec?.quantity !== null &&
    rec?.quantity !== undefined;
  const quantityMatch = bothHaveQuantity && inv!.quantity === rec!.quantity;

  // Price validation: +/- 5 tolerance
  const bothHavePrice =
    inv?.total_price !== null &&
    inv?.total_price !== undefined &&
    rec?.total_price !== null &&
    rec?.total_price !== undefined;
  const priceMatch =
    bothHavePrice && Math.abs(inv!.total_price! - rec!.total_price!) <= 5;

  const handleReviewedToggle = () => {
    dispatch({
      type: 'UPDATE_PAIR',
      rowId,
      pairId: pair.id,
      updates: { reviewed: !pair.reviewed },
    });
  };

  const handleItemFieldEdit = (
    side: 'invoice' | 'receipt',
    field: keyof LineItem,
    value: string
  ) => {
    const item = side === 'invoice' ? inv : rec;
    if (!item) return;

    let parsedValue: string | number | boolean | null = value;
    if (['quantity', 'unit_price', 'total_price', 'total_price_with_vat', 'vat_rate'].includes(field)) {
      parsedValue = parseCzechNumber(value);
    }

    const updatedItem = { ...item, [field]: parsedValue };
    dispatch({
      type: 'UPDATE_PAIR',
      rowId,
      pairId: pair.id,
      updates: {
        [side === 'invoice' ? 'invoiceItem' : 'receiptItem']: updatedItem,
      },
    });
  };

  const renderItemContent = (
    item: typeof inv,
    side: 'invoice' | 'receipt'
  ) => {
    if (!item) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-gray-400 italic">
          —
        </div>
      );
    }

    const borderColor =
      side === 'invoice' ? 'border-l-blue-400' : 'border-l-green-400';

    return (
      <div className={`border-l-4 ${borderColor} pl-2`}>
        <InlineEditable
          value={item.item_name}
          onSave={(v) => handleItemFieldEdit(side, 'item_name', v)}
          className="text-sm font-medium text-gray-800"
        />
        <div className="flex items-center gap-1 mt-1 text-xs">
          <InlineEditable
            value={item.quantity !== null ? String(item.quantity) : ''}
            onSave={(v) => handleItemFieldEdit(side, 'quantity', v)}
            className={
              bothHaveQuantity
                ? quantityMatch
                  ? 'text-green-700 font-medium'
                  : 'text-red-700 font-medium'
                : 'text-gray-500'
            }
            displayValue={formatCzechNumber(item.quantity, 2)}
          />
          <span className="text-gray-400">{item.unit ?? ''}</span>
        </div>
        <div className="mt-0.5 text-xs">
          <InlineEditable
            value={item.total_price !== null ? String(item.total_price) : ''}
            onSave={(v) => handleItemFieldEdit(side, 'total_price', v)}
            className={
              bothHavePrice
                ? priceMatch
                  ? 'text-green-700 font-medium'
                  : 'text-red-700 font-medium'
                : 'text-gray-500'
            }
            displayValue={`${formatCzechNumber(item.total_price)} Kč`}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm mb-3 transition-opacity ${
        pair.reviewed ? 'opacity-60' : ''
      }`}
    >
      {/* Header with reviewed toggle */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
          <input
            type="checkbox"
            checked={pair.reviewed}
            onChange={handleReviewedToggle}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          Zkontrolováno
          {pair.reviewed && (
            <span className="text-green-600 font-bold">&#10003;</span>
          )}
        </label>
      </div>

      {/* Two-column pair display */}
      <div className="flex">
        {/* Invoice side */}
        <PairDropZone pairId={pair.id} side="invoice">
          <div className="relative group">
            {renderItemContent(inv, 'invoice')}
            {inv && (
              <button
                onClick={() => onUnpair(pair.id, 'invoice')}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-100 text-red-600 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                title="Odpárovat"
              >
                &times;
              </button>
            )}
          </div>
        </PairDropZone>

        {/* Divider */}
        <div className="w-px bg-gray-200 my-2" />

        {/* Receipt side */}
        <PairDropZone pairId={pair.id} side="receipt">
          <div className="relative group">
            {renderItemContent(rec, 'receipt')}
            {rec && (
              <button
                onClick={() => onUnpair(pair.id, 'receipt')}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-100 text-red-600 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                title="Odpárovat"
              >
                &times;
              </button>
            )}
          </div>
        </PairDropZone>
      </div>
    </div>
  );
}

