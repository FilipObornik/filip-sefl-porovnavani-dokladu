import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LineItem } from '@/state/types';
import { useAppContext } from '@/state/app-context';
import DraggableItem from './DraggableItem';

interface ItemPanelProps {
  title: string;
  items: LineItem[];
  side: 'invoice' | 'receipt';
  documentId: string;
}

export default function ItemPanel({ title, items, side, documentId }: ItemPanelProps) {
  const { dispatch } = useAppContext();
  const borderColor =
    side === 'invoice' ? 'border-blue-400' : 'border-green-400';
  const bgColor = side === 'invoice' ? 'bg-blue-50' : 'bg-green-50';
  const textColor = side === 'invoice' ? 'text-blue-700' : 'text-green-700';

  return (
    <div className="flex flex-col h-full">
      <div
        className={`${bgColor} border-b-2 ${borderColor} px-3 py-2 rounded-t`}
      >
        <h3 className={`text-sm font-semibold ${textColor}`}>{title}</h3>
        <span className="text-xs text-gray-500">
          {items.length} nespárovaných
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 bg-gray-50 min-h-[200px]">
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
          onClick={() => {
            const newItem: LineItem = {
              id: uuidv4(),
              item_name: 'Nová položka',
              quantity: null,
              unit: null,
              unit_price: null,
              total_price: null,
              total_price_with_vat: null,
              vat_rate: null,
              sku: null,
              document_closed: null,
            };
            dispatch({ type: 'ADD_LINE_ITEM', documentId, item: newItem });
          }}
          className={`w-full px-2 py-1.5 text-xs font-medium rounded transition-colors ${
            side === 'invoice'
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          + Přidat položku
        </button>
      </div>
    </div>
  );
}
