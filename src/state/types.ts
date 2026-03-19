/** 'ok' = přesná shoda, 'tolerance' = rozdíl do ±5 Kč, 'error' = mimo toleranci, null = data nejsou */
export type VerifyStatus = 'ok' | 'tolerance' | 'error' | null;

/** Tolerance for all price/VAT comparisons (Kč) */
export const VERIFY_TOLERANCE = 5;

export interface DocumentTotals {
  total_price: number | null;
  total_vat: number | null;
  total_price_with_vat: number | null;
}

export interface LineItem {
  id: string;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  total_price_with_vat: number | null;
  vat_rate: number | null;
  sku: string | null;
  /** Fields that were calculated (not directly extracted from the document). */
  derived_fields?: string[];
  /** Fields that were manually edited by the user. */
  edited_fields?: string[];
}

/** LineItem fields that contain numeric values and need Czech number parsing on edit */
export const NUMERIC_LINE_ITEM_FIELDS = [
  'quantity',
  'unit_price',
  'total_price',
  'total_price_with_vat',
  'vat_rate',
] as const satisfies (keyof LineItem)[];

export interface Document {
  id: string;
  type: 'invoice' | 'receipt';
  name: string;
  filePath: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  items: LineItem[];
  error?: string;
  rawData: string;
  /** Document-level totals extracted directly from the document header (for verification). */
  documentTotals?: DocumentTotals;
  /** Whether the document is marked as closed (e.g. receipt confirmed). */
  documentClosed: boolean | null;
}

export interface MatchingPair {
  id: string;
  invoiceItemIds: string[];
  receiptItemIds: string[];
  reviewed: boolean;
}

export interface ComparisonRow {
  id: string;
  note: string;
  invoiceId: string | null;
  receiptId: string | null;
  matchingPairs: MatchingPair[];
  status: 'empty' | 'partial' | 'ready' | 'processing' | 'done' | 'error';
}

export interface AppState {
  invoices: Document[];
  receipts: Document[];
  comparisonRows: ComparisonRow[];
}

export interface ExportData {
  version: string;
  exportedAt: string;
  invoices: Document[];
  receipts: Document[];
  comparisonRows: ComparisonRow[];
}
