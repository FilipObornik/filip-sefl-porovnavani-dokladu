import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';
import { ComparisonRow, Document, LineItem, VerifyStatus } from '@/state/types';
import { useAppContext } from '@/state/app-context';
import { formatCzechNumber } from '@/lib/number-utils';
import ItemPanel from './ItemPanel';
import MatchingArea from './MatchingArea';

export interface CalcTotals {
  price: number;
  vat: number;
  priceWithVat: number;
}

interface DetailLayoutProps {
  row: ComparisonRow;
  invoiceDoc: Document;
  receiptDoc: Document;
  invoiceCalcTotals?: CalcTotals | null;
  receiptCalcTotals?: CalcTotals | null;
  invoiceVerify?: VerifyStatus;
  receiptVerify?: VerifyStatus;
}

export default function DetailLayout({
  row,
  invoiceDoc,
  receiptDoc,
  invoiceCalcTotals,
  receiptCalcTotals,
  invoiceVerify,
  receiptVerify,
}: DetailLayoutProps) {
  const { dispatch } = useAppContext();
  const [activeDragData, setActiveDragData] = useState<{
    item: LineItem;
    side: 'invoice' | 'receipt';
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Compute unmatched items
  const pairedInvoiceItemIds = new Set(
    row.matchingPairs.flatMap((p) => p.invoiceItems).map((i) => i.id)
  );
  const pairedReceiptItemIds = new Set(
    row.matchingPairs.flatMap((p) => p.receiptItems).map((i) => i.id)
  );

  const unmatchedInvoiceItems = invoiceDoc.items.filter(
    (item) => !pairedInvoiceItemIds.has(item.id)
  );
  const unmatchedReceiptItems = receiptDoc.items.filter(
    (item) => !pairedReceiptItemIds.has(item.id)
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as {
      item: LineItem;
      side: 'invoice' | 'receipt';
    } | undefined;
    if (data) {
      setActiveDragData(data);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragData(null);
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as {
      item: LineItem;
      side: 'invoice' | 'receipt';
    } | undefined;
    if (!dragData) return;

    const overId = over.id as string;

    if (overId === 'new-pair' || overId === 'matching-area') {
      // Create new pair with just this item
      const newPair = {
        id: uuidv4(),
        invoiceItems: dragData.side === 'invoice' ? [dragData.item] : [],
        receiptItems: dragData.side === 'receipt' ? [dragData.item] : [],
        reviewed: false,
      };
      dispatch({ type: 'ADD_PAIR', rowId: row.id, pair: newPair });
    } else if (overId.startsWith('pair::')) {
      // Parse: pair::{pairId}::{targetSide}
      const parts = overId.split('::');
      const pairId = parts[1];
      const targetSide = parts[2] as 'invoice' | 'receipt';

      // Only accept drops on the matching side
      if (dragData.side === targetSide) {
        const pair = row.matchingPairs.find((p) => p.id === pairId);
        if (!pair) return;
        const itemsKey = targetSide === 'invoice' ? 'invoiceItems' : 'receiptItems';
        const currentItems = pair[itemsKey];
        // Prevent duplicate
        if (currentItems.some((i) => i.id === dragData.item.id)) return;
        dispatch({
          type: 'UPDATE_PAIR',
          rowId: row.id,
          pairId,
          updates: { [itemsKey]: [...currentItems, dragData.item] },
        });
      }
    }
  }

  function handleUnpair(pairId: string, side: 'invoice' | 'receipt', itemId: string) {
    const pair = row.matchingPairs.find((p) => p.id === pairId);
    if (!pair) return;

    const itemsKey = side === 'invoice' ? 'invoiceItems' : 'receiptItems';
    const otherKey = side === 'invoice' ? 'receiptItems' : 'invoiceItems';
    const newItems = pair[itemsKey].filter((i) => i.id !== itemId);

    if (newItems.length === 0 && pair[otherKey].length === 0) {
      dispatch({ type: 'REMOVE_PAIR', rowId: row.id, pairId });
    } else {
      dispatch({
        type: 'UPDATE_PAIR',
        rowId: row.id,
        pairId,
        updates: { [itemsKey]: newItems },
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-220px)]">
        {/* Left: Invoice unmatched items */}
        <div className="col-span-1 overflow-hidden flex flex-col">
          <ItemPanel
            title="Faktura"
            items={unmatchedInvoiceItems}
            side="invoice"
            documentId={invoiceDoc.id}
            document={invoiceDoc}
            calcTotals={invoiceCalcTotals}
            verifyOk={invoiceVerify}
          />
        </div>

        {/* Center: Matched pairs */}
        <div className="col-span-2 overflow-hidden flex flex-col">
          <MatchingArea row={row} onUnpair={handleUnpair} />
        </div>

        {/* Right: Receipt unmatched items */}
        <div className="col-span-1 overflow-hidden flex flex-col">
          <ItemPanel
            title="Příjemka"
            items={unmatchedReceiptItems}
            side="receipt"
            documentId={receiptDoc.id}
            document={receiptDoc}
            calcTotals={receiptCalcTotals}
            verifyOk={receiptVerify}
          />
        </div>
      </div>

      {/* Drag overlay — plain visual clone, no useDraggable hook */}
      <DragOverlay>
        {activeDragData ? (
          <DragOverlayContent
            item={activeDragData.item}
            side={activeDragData.side}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DragOverlayContent({ item, side }: { item: LineItem; side: 'invoice' | 'receipt' }) {
  const borderColor = side === 'invoice' ? 'border-l-blue-500' : 'border-l-green-500';
  return (
    <div
      className={`bg-white border border-gray-200 border-l-4 ${borderColor} rounded p-3 shadow-lg cursor-grabbing w-64`}
    >
      <div className="text-sm font-medium text-gray-800 truncate">
        {item.item_name}
      </div>
      <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
        <span>{formatCzechNumber(item.quantity, 2)} {item.unit ?? ''}</span>
        <span className="font-medium text-gray-700">{formatCzechNumber(item.total_price)} Kč</span>
      </div>
    </div>
  );
}
