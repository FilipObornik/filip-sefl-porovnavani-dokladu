/**
 * Parse Czech-formatted number string to JS number.
 * Handles formats like "1.200,50" → 1200.50, "1 200,50" → 1200.50
 */
export function parseCzechNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;

  const cleaned = value
    .replace(/\s/g, '')    // remove spaces
    .replace(/\./g, '')    // remove thousand separators (dots)
    .replace(',', '.');    // replace decimal comma with dot

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Format number for display in Czech locale.
 */
export function formatCzechNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '–';
  return value.toLocaleString('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format number without trailing zeros (e.g. 8.00 → "8", 8.50 → "8,5").
 */
export function formatCzechNumberAuto(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
