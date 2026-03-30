import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ComparisonRow, Document } from '@/state/types';
import { DND_NEW_PAIR, DND_MATCHING_AREA } from '@/constants/dnd';
import PairBox from './PairBox';

interface MatchingAreaProps {
  row: ComparisonRow;
  invoiceDoc: Document;
  receiptDoc: Document;
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

export default function MatchingArea({ row, invoiceDoc, receiptDoc }: MatchingAreaProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: DND_MATCHING_AREA,
  });
  const [onlyMismatches, setOnlyMismatches] = useState(false);

  const invoiceItemMap = new Map(invoiceDoc.items.map((i) => [i.id, i]));
  const receiptItemMap = new Map(receiptDoc.items.map((i) => [i.id, i]));

  const isFullyArchivedPair = (pair: typeof row.matchingPairs[0]) => {
    const allInv = pair.invoiceItemIds.map((id) => invoiceItemMap.get(id)).filter(Boolean);
    const allRec = pair.receiptItemIds.map((id) => receiptItemMap.get(id)).filter(Boolean);
    const activeInv = allInv.filter((i) => !i!.archived);
    const activeRec = allRec.filter((i) => !i!.archived);
    return activeInv.length === 0 && activeRec.length === 0 && (allInv.length > 0 || allRec.length > 0);
  };

  const activePairs = row.matchingPairs.filter((pair) => !isFullyArchivedPair(pair));
  const archivedPairs = row.matchingPairs.filter(isFullyArchivedPair);

  const visiblePairs = onlyMismatches
    ? activePairs.filter((pair) => {
        const invItems = pair.invoiceItemIds
          .map((id) => invoiceItemMap.get(id))
          .filter((i) => i !== undefined && !i.archived);
        const recItems = pair.receiptItemIds
          .map((id) => receiptItemMap.get(id))
          .filter((i) => i !== undefined && !i.archived);

        if (invItems.length === 0 || recItems.length === 0) return true;

        const invQty = invItems.reduce((s, i) => s + (i!.quantity ?? 0), 0);
        const recQty = recItems.reduce((s, i) => s + (i!.quantity ?? 0), 0);
        const invPrice = invItems.reduce((s, i) => s + (i!.total_price ?? 0), 0);
        const recPrice = recItems.reduce((s, i) => s + (i!.total_price ?? 0), 0);

        const qtyMatch = invQty === recQty;
        const priceMatch = Math.abs(invPrice - recPrice) <= 5;
        return !qtyMatch || !priceMatch;
      })
    : activePairs;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-50 border-b-2 border-slate-400 px-3 py-2 rounded-t">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              Napárované položky
            </h3>
            <span className="text-xs text-gray-500">
              {activePairs.length} párů{archivedPairs.length > 0 ? `, ${archivedPairs.length} archivovaných` : ''}
            </span>
          </div>
          <button
            onClick={() => setOnlyMismatches((v) => !v)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              onlyMismatches
                ? 'bg-red-100 text-red-700 border-red-300 font-medium'
                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {onlyMismatches ? '✗ Pouze neshody' : 'Pouze neshody'}
          </button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 rounded-b min-h-[200px] transition-colors ${
          isOver ? 'bg-slate-50 ring-2 ring-slate-300' : 'bg-gray-50'
        }`}
      >
        <NewPairDropZone />

        {activePairs.length === 0 && archivedPairs.length === 0 ? (
          <div className="flex items-center justify-center h-[80%] text-sm text-gray-400 italic text-center">
            Přetáhněte položky pro napárování
          </div>
        ) : visiblePairs.length === 0 && !onlyMismatches ? null : visiblePairs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400 italic text-center">
            Žádné neshody
          </div>
        ) : (
          visiblePairs.map((pair) => {
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
                rowId={row.id}
              />
            );
          })
        )}

        {archivedPairs.length > 0 && (
          <>
            <div className="mt-3 mb-1 pt-2 border-t border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
              Archivované
            </div>
            {archivedPairs.map((pair) => {
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
                  rowId={row.id}
                  isArchived
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
