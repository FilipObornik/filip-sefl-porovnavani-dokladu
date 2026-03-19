import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DND_UNMATCHED_INVOICE, DND_UNMATCHED_RECEIPT } from '@/constants/dnd';
import { Document, LineItem, VerifyStatus, VERIFY_TOLERANCE } from '@/state/types';
import { useAppContext } from '@/state/app-context';
import { formatCzechNumber } from '@/lib/number-utils';
import { CalcTotals } from './DetailLayout';
import DraggableItem from './DraggableItem';
import DocumentVerifyModal from './DocumentVerifyModal';
import AddItemModal from './AddItemModal';

interface ItemPanelProps {
  title: string;
  items: LineItem[];
  side: 'invoice' | 'receipt';
  documentId: string;
  document: Document;
  calcTotals?: CalcTotals | null;
  verifyOk?: VerifyStatus;
}

export default function ItemPanel({ title, items, side, documentId, document: doc, calcTotals, verifyOk }: ItemPanelProps) {
  const { dispatch } = useAppContext();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: side === 'invoice' ? DND_UNMATCHED_INVOICE : DND_UNMATCHED_RECEIPT,
  });
  const borderColor = side === 'invoice' ? 'border-blue-400' : 'border-green-400';
  const bgColor = side === 'invoice' ? 'bg-blue-50' : 'bg-green-50';
  const textColor = side === 'invoice' ? 'text-blue-700' : 'text-green-700';

  const dt = doc.documentTotals;
  const hasDocTotals = dt && (dt.total_price !== null || dt.total_vat !== null || dt.total_price_with_vat !== null);

  return (
    <div className="flex flex-col h-full">
      <div className={`${bgColor} border-b-2 ${borderColor} px-3 py-2 rounded-t`}>
        {/* Title row */}
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-sm font-semibold ${textColor}`}>{title}</h3>
          <button
            onClick={() => setVerifyOpen(true)}
            className={`p-1 rounded hover:bg-white/50 transition-colors ${textColor}`}
            title="Zobrazit detail dokladu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* Totals table */}
        {calcTotals && (
          <div className="text-xs mb-2">
            {hasDocTotals && (
              <div className="grid grid-cols-3 gap-x-1 text-gray-400 mb-0.5 font-medium">
                <span></span>
                <span>Spočítáno</span>
                <span>Na dokladu</span>
              </div>
            )}
            <TotalsRow
              label="Bez DPH"
              calc={calcTotals.price}
              stated={hasDocTotals ? dt?.total_price ?? null : null}
            />
            <TotalsRow
              label="DPH"
              calc={calcTotals.vat}
              stated={hasDocTotals ? dt?.total_vat ?? null : null}
            />
            <TotalsRow
              label="S DPH"
              calc={calcTotals.priceWithVat}
              stated={hasDocTotals ? dt?.total_price_with_vat ?? null : null}
              bold
            />
          </div>
        )}

        {/* Verification verdict */}
        {verifyOk === 'ok' && (
          <div className="text-xs font-semibold px-2 py-1 rounded mb-1 bg-green-200 text-green-800">
            ✓ Součty přesně sedí s dokladem
          </div>
        )}
        {verifyOk === 'tolerance' && (
          <div className="text-xs font-semibold px-2 py-1 rounded mb-1 bg-amber-100 text-amber-800 border border-amber-300">
            ~ Drobný rozdíl (v toleranci ±{VERIFY_TOLERANCE} Kč) — v pořádku
          </div>
        )}
        {verifyOk === 'error' && (
          <div className="text-xs font-semibold px-2 py-1 rounded mb-1 bg-red-200 text-red-800">
            ✗ Součty nesedí s dokladem
          </div>
        )}
        {verifyOk === null && calcTotals && (
          <div className="text-xs text-gray-400 italic mb-1">
            Doklad nemá celkové součty k ověření
          </div>
        )}

        <span className="text-xs text-gray-500">
          {items.length} {items.length === 1 ? 'nespárovaná položka' : items.length >= 2 && items.length <= 4 ? 'nespárované položky' : 'nespárovaných položek'}
        </span>
      </div>

      <div
        ref={setDropRef}
        className={`flex-1 overflow-y-auto p-2 min-h-[200px] transition-colors ${
          isOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : 'bg-gray-50'
        }`}
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400 italic">
            Žádné nespárované položky
          </div>
        ) : (
          items.map((item) => (
            <DraggableItem key={item.id} item={item} side={side} />
          ))
        )}
      </div>
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={() => setAddOpen(true)}
          className={`w-full px-2 py-1.5 text-xs font-medium rounded transition-colors ${
            side === 'invoice'
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          + Přidat položku
        </button>
      </div>

      {verifyOpen && (
        <DocumentVerifyModal document={doc} onClose={() => setVerifyOpen(false)} />
      )}
      {addOpen && (
        <AddItemModal
          side={side}
          onAdd={(item) => {
            dispatch({ type: 'ADD_LINE_ITEM', documentId, item });
            setAddOpen(false);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

function TotalsRow({
  label,
  calc,
  stated,
  bold,
}: {
  label: string;
  calc: number;
  stated: number | null;
  bold?: boolean;
}) {
  const textClass = bold ? 'font-semibold text-gray-700' : 'text-gray-600';

  if (stated === null) {
    return (
      <div className={`flex justify-between ${textClass}`}>
        <span className="text-gray-400">{label}:</span>
        <span>{formatCzechNumber(calc)} Kč</span>
      </div>
    );
  }

  const diff = Math.abs(calc - stated);
  const rowStatus: VerifyStatus = diff === 0 ? 'ok' : diff <= VERIFY_TOLERANCE ? 'tolerance' : 'error';
  const statedColor = rowStatus === 'ok' ? 'text-green-700' : rowStatus === 'tolerance' ? 'text-amber-700' : 'text-red-700';

  return (
    <div className={`grid grid-cols-3 gap-x-1 ${textClass}`}>
      <span className="text-gray-400">{label}:</span>
      <span>{formatCzechNumber(calc)} Kč</span>
      <span className={statedColor}>
        {formatCzechNumber(stated)} Kč
      </span>
    </div>
  );
}
