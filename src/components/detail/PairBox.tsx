import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { MatchingPair, LineItem, NUMERIC_LINE_ITEM_FIELDS } from '@/state/types';
import { dndPairDropId } from '@/constants/dnd';
import { formatCzechNumber, parseCzechNumber } from '@/lib/number-utils';
import { useAppContext } from '@/state/app-context';
import { useSettings } from '@/state/settings-context';
import InlineEditable from './InlineEditable';

interface PairBoxProps {
  pair: MatchingPair;
  invoiceItems: LineItem[];
  receiptItems: LineItem[];
  invoiceDocId: string;
  receiptDocId: string;
  rowId: string;
  isArchived?: boolean;
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
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="cursor-grab active:cursor-grabbing"
    >
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
      className={`w-1/2 min-w-0 rounded transition-colors ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-300' : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function PairBox({ pair, invoiceItems, receiptItems, invoiceDocId, receiptDocId, rowId, isArchived }: PairBoxProps) {
  const { dispatch } = useAppContext();
  const { settings } = useSettings();
  const invItems = isArchived ? invoiceItems : invoiceItems.filter((i) => !i.archived);
  const recItems = isArchived ? receiptItems : receiptItems.filter((i) => !i.archived);
  const archivedInvoiceCount = invoiceItems.filter((i) => i.archived).length;
  const archivedReceiptCount = receiptItems.filter((i) => i.archived).length;

  // Aggregate totals for validation
  const invoiceTotalPrice = invItems.reduce((s, i) => s + (i.total_price ?? 0), 0);
  const receiptTotalPrice = recItems.reduce((s, i) => s + (i.total_price ?? 0), 0);
  const invoiceTotalQty = invItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const receiptTotalQty = recItems.reduce((s, i) => s + (i.quantity ?? 0), 0);

  const bothSidesHaveItems = invItems.length > 0 && recItems.length > 0;
  const priceMatch = bothSidesHaveItems && Math.abs(invoiceTotalPrice - receiptTotalPrice) <= settings.toleranceItem;
  const qtyMatch = bothSidesHaveItems && invoiceTotalQty === receiptTotalQty;

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
    const isInvoice = side === 'invoice';
    const borderClass = isInvoice
      ? 'border-l-4 border-l-blue-400'
      : 'border-r-4 border-r-green-400';
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

    const hasError = bothSidesHaveItems && (!qtyMatch || !priceMatch);

    const itemContent = (item: LineItem) => (
      <div className={`${borderClass} px-2 py-0.5 relative group rounded${!isArchived && hasError ? ' bg-red-50' : ''}`}>
        {isArchived ? (
          <>
            <div className={`text-sm font-medium text-gray-500${isInvoice ? ' text-right' : ''}`}>{item.item_name}</div>
            <div className={`flex items-center gap-1 mt-0.5 text-xs text-gray-400${isInvoice ? ' justify-end' : ''}`}>
              <span>{formatCzechNumber(item.quantity, 2)}</span>
              <span>{item.unit ?? ''}</span>
              <span className="text-gray-300 mx-0.5">·</span>
              <span>{formatCzechNumber(item.total_price)} Kč</span>
            </div>
          </>
        ) : (
          <>
            <InlineEditable
              value={item.item_name}
              onSave={(v) => handleItemFieldEdit(side, documentId, item, 'item_name', v)}
              className={`text-sm font-medium text-gray-800${isInvoice ? ' text-right' : ''}`}
            />
            {/* MJ + cena na jednom řádku */}
            <div className={`flex items-center gap-1 mt-0.5 text-xs${isInvoice ? ' justify-end' : ''}`}>
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
              <span className="text-gray-300 mx-0.5">·</span>
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
          </>
        )}
      </div>
    );

    return (
      <div className="space-y-1">
        {items.map((item) => (
          isArchived ? (
            <div key={item.id}>{itemContent(item)}</div>
          ) : (
            <DraggablePairItem key={item.id} item={item} side={side} pairId={pair.id}>
              {itemContent(item)}
            </DraggablePairItem>
          )
        ))}
      </div>
    );
  };

  const invoiceSideContent = (
    <>
      {renderItemList(invItems, 'invoice', invoiceDocId)}
      {!isArchived && archivedInvoiceCount > 0 && (
        <div className="px-2 py-0.5 text-xs text-red-600 font-medium">
          ⚠ {archivedInvoiceCount} archivovaná {archivedInvoiceCount === 1 ? 'položka' : archivedInvoiceCount < 5 ? 'položky' : 'položek'}
        </div>
      )}
    </>
  );

  const receiptSideContent = (
    <>
      {renderItemList(recItems, 'receipt', receiptDocId)}
      {!isArchived && archivedReceiptCount > 0 && (
        <div className="px-2 py-0.5 text-xs text-red-600 font-medium">
          ⚠ {archivedReceiptCount} archivovaná {archivedReceiptCount === 1 ? 'položka' : archivedReceiptCount < 5 ? 'položky' : 'položek'}
        </div>
      )}
    </>
  );

  return (
    <div className={`border rounded-lg shadow-sm mb-1.5${isArchived ? ' bg-gray-200 border-gray-300' : ' bg-white border-gray-200'}`}>
      {/* Two-column pair display */}
      <div className="flex">
        {/* Invoice side */}
        {isArchived ? (
          <div className="w-1/2 min-w-0 rounded">{invoiceSideContent}</div>
        ) : (
          <PairDropZone pairId={pair.id} side="invoice">{invoiceSideContent}</PairDropZone>
        )}

        {/* Divider */}
        <div className="w-px bg-gray-200 my-2" />

        {/* Receipt side */}
        {isArchived ? (
          <div className="w-1/2 min-w-0 rounded">{receiptSideContent}</div>
        ) : (
          <PairDropZone pairId={pair.id} side="receipt">{receiptSideContent}</PairDropZone>
        )}
      </div>
    </div>
  );
}
