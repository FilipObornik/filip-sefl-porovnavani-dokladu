import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { LineItem } from '@/state/types';
import { formatCzechNumber } from '@/lib/number-utils';

interface DraggableItemProps {
  item: LineItem;
  side: 'invoice' | 'receipt';
  isArchived?: boolean;
}

export default function DraggableItem({ item, side, isArchived = false }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `${side}-${item.id}`,
      data: { item, side, isArchived },
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  const borderColor =
    side === 'invoice' ? 'border-l-blue-500' : 'border-l-green-500';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`border border-l-4 ${borderColor} rounded p-3 mb-2 cursor-grab active:cursor-grabbing transition-shadow ${
        isArchived
          ? 'bg-gray-200 border-gray-300 shadow-none hover:shadow-sm'
          : 'bg-white border-gray-200 shadow-sm hover:shadow'
      } ${isDragging ? 'opacity-50 shadow-lg z-50' : ''}`}
    >
      <div className={`text-sm font-medium break-words ${isArchived ? 'text-gray-600' : 'text-gray-800'}`}>
        {item.item_name}
      </div>
      <div className={`flex items-center justify-between mt-1 text-xs ${isArchived ? 'text-gray-500' : 'text-gray-500'}`}>
        <span>
          {formatCzechNumber(item.quantity, 2)} {item.unit ?? ''}
        </span>
        <span className={`font-medium ${isArchived ? 'text-gray-500' : 'text-gray-700'}`}>
          {formatCzechNumber(item.total_price)} Kč
        </span>
      </div>
    </div>
  );
}
