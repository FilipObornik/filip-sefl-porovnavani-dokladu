export const DND_NEW_PAIR = 'new-pair';
export const DND_MATCHING_AREA = 'matching-area';
export const DND_UNMATCHED_INVOICE = 'unmatched-invoice';
export const DND_UNMATCHED_RECEIPT = 'unmatched-receipt';
export const DND_ARCHIVE_INVOICE = 'archive-invoice';
export const DND_ARCHIVE_RECEIPT = 'archive-receipt';

export const dndPairDropId = (pairId: string, side: 'invoice' | 'receipt') =>
  `pair::${pairId}::${side}`;

export const parsePairDropId = (id: string): { pairId: string; side: 'invoice' | 'receipt' } | null => {
  const parts = id.split('::');
  if (parts.length !== 3 || parts[0] !== 'pair') return null;
  return { pairId: parts[1], side: parts[2] as 'invoice' | 'receipt' };
};
