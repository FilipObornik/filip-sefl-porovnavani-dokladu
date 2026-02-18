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
}

export interface MatchingPair {
  id: string;
  invoiceItem: LineItem | null;
  receiptItem: LineItem | null;
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
