import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { MatchingPair, LineItem, NUMERIC_LINE_ITEM_FIELDS } from '@/state/types';
import { dndPairDropId } from '@/constants/dnd';
import { formatCzechNumber, parseCzechNumber } from '@/lib/number-utils';
import { useAppContext } from '@/state/app-context';
import InlineEditable from './InlineEditable';

interface PairBoxProps {
  pair: MatchingPair;
  invoiceItems: LineItem[];
  receiptItems: LineItem[];
  invoiceDocId: string;
  receiptDocId: string;
  onUnpair: (pairId: string, side: 'invoice' | 'receipt', itemId: string) => void;
  rowId: string;
}

function DraggablePairItem({
  item,
  side,
  pairId,
  children,
}: {
  item: LineItem;
  side: 'invoice' | 'receipt';
  pairId: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `paired-${item.id}`,
    data: { item, side, pairId },
  });

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <span
        {...listeners}
        {...attributes}
        className="absolute -left-5 top-1 opacity-0 group-hover:opacity-100 cursor-grab text-gray-300 hover:text-gray-500 select-none text-base leading-none"
        title="Přetáhněte pro odpárování"
      >
        ⠿
      </span>
      {children}
    </div>
  );
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
    id: dndPairDropId(pairId, side),
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-1/2 min-w-0 min-h-[80px] p-2 rounded transition-colors ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-300' : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function PairBox({ pair, invoiceItems, receiptItems, invoiceDocId, receiptDocId, onUnpair, rowId }: PairBoxProps) {
  const { dispatch } = useAppContext();
  const invItems = invoiceItems;
  const recItems = receiptItems;

  // Aggregate totals for validation
  const invoiceTotalPrice = invItems.reduce((s, i) => s + (i.total_price ?? 0), 0);
  const receiptTotalPrice = recItems.reduce((s, i) => s + (i.total_price ?? 0), 0);
  const invoiceTotalQty = invItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const receiptTotalQty = recItems.reduce((s, i) => s + (i.quantity ?? 0), 0);

  const bothSidesHaveItems = invItems.length > 0 && recItems.length > 0;
  const priceMatch = bothSidesHaveItems && Math.abs(invoiceTotalPrice - receiptTotalPrice) <= 5;
  const qtyMatch = bothSidesHaveItems && invoiceTotalQty === receiptTotalQty;

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
    documentId: string,
    item: LineItem,
    field: keyof LineItem,
    value: string
  ) => {
    let parsedValue: string | number | boolean | null = value;
    if ((NUMERIC_LINE_ITEM_FIELDS as readonly string[]).includes(field)) {
      parsedValue = parseCzechNumber(value);
    }

    // Manual edit clears derived flag and marks field as edited
    const derived_fields = (item.derived_fields ?? []).filter((f) => f !== field);
    const edited_fields = Array.from(new Set([...(item.edited_fields ?? []), field as string]));

    dispatch({
      type: 'UPDATE_LINE_ITEM',
      documentId,
      itemId: item.id,
      updates: { [field]: parsedValue, derived_fields, edited_fields },
    });
  };

  const renderItemList = (items: LineItem[], side: 'invoice' | 'receipt', documentId: string) => {
    const borderColor = side === 'invoice' ? 'border-l-blue-400' : 'border-l-green-400';
    const qtyColor = !bothSidesHaveItems ? 'text-gray-500' : qtyMatch ? 'text-green-700' : 'text-red-700';
    const priceColor = !bothSidesHaveItems ? 'text-gray-500' : priceMatch ? 'text-green-700' : 'text-red-700';

    if (items.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-gray-400 italic">
          —
        </div>
      );
    }

    const isDerived = (item: LineItem, field: string) =>
      (item.derived_fields ?? []).includes(field);
    const isEdited = (item: LineItem, field: string) =>
      (item.edited_fields ?? []).includes(field);

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <DraggablePairItem key={item.id} item={item} side={side} pairId={pair.id}>
          <div className={`border-l-4 ${borderColor} pl-2 relative group`}>
            <InlineEditable
              value={item.item_name}
              onSave={(v) => handleItemFieldEdit(side, documentId, item, 'item_name', v)}
              className="text-sm font-medium text-gray-800"
            />
            <div className="flex items-center gap-1 mt-1 text-xs">
              <InlineEditable
                value={item.quantity !== null ? String(item.quantity) : ''}
                onSave={(v) => handleItemFieldEdit(side, documentId, item, 'quantity', v)}
                className={qtyColor}
                displayValue={formatCzechNumber(item.quantity, 2)}
              />
              {isDerived(item, 'quantity') && (
                <span title="Dopočítáno" className="text-amber-500 text-[10px] leading-none">~</span>
              )}
              {isEdited(item, 'quantity') && (
                <span title="Ručně upraveno" className="text-blue-500 text-[10px] leading-none">✎</span>
              )}
              <span className="text-gray-400">{item.unit ?? ''}</span>
            </div>
            <div className="mt-0.5 text-xs flex items-center gap-1">
              <InlineEditable
                value={item.total_price !== null ? String(item.total_price) : ''}
                onSave={(v) => handleItemFieldEdit(side, documentId, item, 'total_price', v)}
                className={priceColor}
                displayValue={`${formatCzechNumber(item.total_price)} Kč`}
              />
              {isDerived(item, 'total_price') && (
                <span title="Dopočítáno" className="text-amber-500 text-[10px] leading-none">~</span>
              )}
              {isEdited(item, 'total_price') && (
                <span title="Ručně upraveno" className="text-blue-500 text-[10px] leading-none">✎</span>
              )}
            </div>
            <button
              onClick={() => onUnpair(pair.id, side, item.id)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-100 text-red-600 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
              title="Odpárovat"
            >
              &times;
            </button>
          </div>
          </DraggablePairItem>
        ))}
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
          {renderItemList(invItems, 'invoice', invoiceDocId)}
        </PairDropZone>

        {/* Divider */}
        <div className="w-px bg-gray-200 my-2" />

        {/* Receipt side */}
        <PairDropZone pairId={pair.id} side="receipt">
          {renderItemList(recItems, 'receipt', receiptDocId)}
        </PairDropZone>
      </div>

      {/* Totals comparison footer (only when both sides have items) */}
      {bothSidesHaveItems && (
        <div className="flex border-t border-gray-100 px-2 py-1 text-xs bg-gray-50 rounded-b-lg">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-gray-400">Σ ks:</span>
            <span className={qtyMatch ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
              {formatCzechNumber(invoiceTotalQty, 2)} / {formatCzechNumber(receiptTotalQty, 2)}
            </span>
          </div>
          <div className="flex-1 flex items-center gap-2 justify-end">
            <span className="text-gray-400">Σ Kč:</span>
            <span className={priceMatch ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
              {formatCzechNumber(invoiceTotalPrice)} / {formatCzechNumber(receiptTotalPrice)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
