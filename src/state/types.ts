/** 'ok' = přesná shoda, 'tolerance' = rozdíl do ±5 Kč, 'error' = mimo toleranci, null = data nejsou */
export type VerifyStatus = 'ok' | 'tolerance' | 'error' | null;

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
  document_closed: boolean | null;
  /** Fields that were calculated (not directly extracted from the document). */
  derived_fields?: string[];
  /** Fields that were manually edited by the user. */
  edited_fields?: string[];
}

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
}

export interface MatchingPair {
  id: string;
  invoiceItems: LineItem[];
  receiptItems: LineItem[];
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
