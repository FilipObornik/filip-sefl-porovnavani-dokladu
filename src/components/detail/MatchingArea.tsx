import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ComparisonRow } from '@/state/types';
import PairBox from './PairBox';

interface MatchingAreaProps {
  row: ComparisonRow;
  onUnpair: (pairId: string, side: 'invoice' | 'receipt') => void;
}

export default function MatchingArea({ row, onUnpair }: MatchingAreaProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'matching-area',
  });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-purple-50 border-b-2 border-purple-400 px-3 py-2 rounded-t">
        <h3 className="text-sm font-semibold text-purple-700">
          Napárované položky
        </h3>
        <span className="text-xs text-gray-500">
          {row.matchingPairs.length} párů
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 rounded-b min-h-[200px] transition-colors ${
          isOver ? 'bg-purple-50 ring-2 ring-purple-300' : 'bg-gray-50'
        }`}
      >
        {row.matchingPairs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400 italic text-center">
            Přetáhněte položky pro napárování
          </div>
        ) : (
          row.matchingPairs.map((pair) => (
            <PairBox
              key={pair.id}
              pair={pair}
              onUnpair={onUnpair}
              rowId={row.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
