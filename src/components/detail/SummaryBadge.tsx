import { formatCzechNumber } from '@/lib/number-utils';

interface SummaryBadgeProps {
  label: string;
  invoiceVal: number;
  receiptVal: number;
  valid: boolean;
  suffix?: string;
}

export default function SummaryBadge({ label, invoiceVal, receiptVal, valid, suffix }: SummaryBadgeProps) {
  const colorClass = valid ? 'text-green-700' : 'text-red-700';
  const bgClass = valid ? 'bg-green-50' : 'bg-red-50';
  const borderClass = valid ? 'border-green-200' : 'border-red-200';

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded border ${bgClass} ${borderClass}`}>
      <span className="text-gray-600 font-medium">{label}:</span>
      <span className={`font-medium ${colorClass}`}>
        {formatCzechNumber(invoiceVal)} / {formatCzechNumber(receiptVal)}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  );
}
