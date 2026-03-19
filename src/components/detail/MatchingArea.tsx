import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ComparisonRow, Document } from '@/state/types';
import { DND_NEW_PAIR, DND_MATCHING_AREA } from '@/constants/dnd';
import PairBox from './PairBox';

interface MatchingAreaProps {
  row: ComparisonRow;
  invoiceDoc: Document;
  receiptDoc: Document;
  onUnpair: (pairId: string, side: 'invoice' | 'receipt', itemId: string) => void;
}

function NewPairDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: DND_NEW_PAIR });

  return (
    <div
      ref={setNodeRef}
      className={`mb-3 border-2 border-dashed rounded-lg py-2 px-3 text-center text-xs transition-colors ${
        isOver
          ? 'border-slate-400 bg-slate-50 text-slate-600'
          : 'border-gray-300 text-gray-400'
      }`}
    >
      + Přetáhněte sem pro nový pár
    </div>
  );
}

export default function MatchingArea({ row, invoiceDoc, receiptDoc, onUnpair }: MatchingAreaProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: DND_MATCHING_AREA,
  });

  const invoiceItemMap = new Map(invoiceDoc.items.map((i) => [i.id, i]));
  const receiptItemMap = new Map(receiptDoc.items.map((i) => [i.id, i]));

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-50 border-b-2 border-slate-400 px-3 py-2 rounded-t">
        <h3 className="text-sm font-semibold text-slate-700">
          Napárované položky
        </h3>
        <span className="text-xs text-gray-500">
          {row.matchingPairs.length} párů
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 rounded-b min-h-[200px] transition-colors ${
          isOver ? 'bg-slate-50 ring-2 ring-slate-300' : 'bg-gray-50'
        }`}
      >
        <NewPairDropZone />

        {row.matchingPairs.length === 0 ? (
          <div className="flex items-center justify-center h-[80%] text-sm text-gray-400 italic text-center">
            Přetáhněte položky pro napárování
          </div>
        ) : (
          row.matchingPairs.map((pair) => {
            const invoiceItems = pair.invoiceItemIds
              .map((id) => invoiceItemMap.get(id))
              .filter((i) => i !== undefined);
            const receiptItems = pair.receiptItemIds
              .map((id) => receiptItemMap.get(id))
              .filter((i) => i !== undefined);

            return (
              <PairBox
                key={pair.id}
                pair={pair}
                invoiceItems={invoiceItems}
                receiptItems={receiptItems}
                invoiceDocId={invoiceDoc.id}
                receiptDocId={receiptDoc.id}
                onUnpair={onUnpair}
                rowId={row.id}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
