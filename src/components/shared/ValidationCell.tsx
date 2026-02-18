import { formatCzechNumber } from '@/lib/number-utils';

interface ValidationCellProps {
  invoiceValue: number | null;
  receiptValue: number | null;
  tolerance: number;
}

export default function ValidationCell({
  invoiceValue,
  receiptValue,
  tolerance,
}: ValidationCellProps) {
  const hasValues = invoiceValue !== null && receiptValue !== null;
  const diff = hasValues ? invoiceValue - receiptValue : null;
  const isWithinTolerance = diff !== null ? Math.abs(diff) <= tolerance : true;

  const borderColor = hasValues
    ? isWithinTolerance
      ? 'border-green-500'
      : 'border-red-500'
    : 'border-gray-300';

  return (
    <td
      className={`px-3 py-2 text-center text-sm border-2 ${borderColor} whitespace-nowrap`}
    >
      <span>{formatCzechNumber(invoiceValue)}</span>
      <span className="mx-1 text-gray-400">/</span>
      <span>{formatCzechNumber(receiptValue)}</span>
      <span className="mx-1 text-gray-400">|</span>
      <span
        className={
          hasValues
            ? isWithinTolerance
              ? 'text-green-700 font-medium'
              : 'text-red-700 font-medium'
            : 'text-gray-400'
        }
      >
        {diff !== null ? formatCzechNumber(diff) : '–'}
      </span>
    </td>
  );
}
