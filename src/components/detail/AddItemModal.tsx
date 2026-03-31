import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { parseCzechNumber } from '@/lib/number-utils';
import { LineItem } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';

interface AddItemModalProps {
  side: 'invoice' | 'receipt';
  onAdd: (item: LineItem) => void;
  onClose: () => void;
}

const EMPTY = { item_name: '', quantity: '', unit: '', unit_price: '', vat_rate: '21' };

export default function AddItemModal({ side, onAdd, onClose }: AddItemModalProps) {
  const [fields, setFields] = useState(EMPTY);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = fields.item_name.trim();
    if (!name) return;
    const qty = parseCzechNumber(fields.quantity);
    const unitPrice = parseCzechNumber(fields.unit_price);
    const vatRate = parseCzechNumber(fields.vat_rate);
    const totalPrice = qty !== null && unitPrice !== null ? qty * unitPrice : null;
    const totalPriceWithVat = totalPrice !== null && vatRate !== null
      ? totalPrice * (1 + vatRate / 100)
      : totalPrice;
    const item: LineItem = {
      id: uuidv4(),
      item_name: name,
      quantity: qty,
      unit: fields.unit.trim() || null,
      unit_price: unitPrice,
      total_price: totalPrice,
      total_price_with_vat: totalPriceWithVat,
      vat_rate: vatRate,
      sku: null,
    };
    onAdd(item);
  };

  const accentBg = side === 'invoice' ? 'bg-blue-600' : 'bg-green-600';
  const accentRing = side === 'invoice' ? 'focus:ring-blue-400' : 'focus:ring-green-400';
  const accentBtn = side === 'invoice'
    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400'
    : 'bg-green-600 hover:bg-green-700 focus:ring-green-400';

  const inputClass = `w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 ${accentRing}`;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-[380px] rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`${accentBg} text-white px-5 py-3 flex items-center justify-between`}>
          <h2 className="text-base font-semibold">Přidat položku</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Název */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Název položky <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={fields.item_name}
              onChange={set('item_name')}
              placeholder="např. Materiál XY"
              className={inputClass}
              required
            />
          </div>

          {/* Množství + MJ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Množství</label>
              <input
                type="text"
                inputMode="decimal"
                value={fields.quantity}
                onChange={set('quantity')}
                placeholder="např. 10"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">MJ (jednotka)</label>
              <input
                type="text"
                value={fields.unit}
                onChange={set('unit')}
                placeholder="např. ks, m, kg"
                className={inputClass}
              />
            </div>
          </div>

          {/* Jedn. cena + DPH */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jedn. cena (Kč)</label>
              <input
                type="text"
                inputMode="decimal"
                value={fields.unit_price}
                onChange={set('unit_price')}
                placeholder="např. 150,00"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">DPH (%)</label>
              <select
                value={fields.vat_rate}
                onChange={set('vat_rate')}
                className={inputClass}
              >
                <option value="0">0 %</option>
                <option value="12">12 %</option>
                <option value="21">21 %</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!fields.item_name.trim()}
              className={`flex-1 py-2 text-sm font-medium text-white rounded transition-colors focus:outline-none focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed ${accentBtn}`}
            >
              Přidat
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              Zrušit
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, globalThis.document.body);
}
