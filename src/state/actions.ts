import { AppState, ComparisonRow, Document, MatchingPair, LineItem } from './types';

export type AppAction =
  | { type: 'ADD_ROW' }
  | { type: 'REMOVE_ROW'; rowId: string }
  | { type: 'UPDATE_ROW_NOTE'; rowId: string; note: string }
  | { type: 'UPDATE_ROW_STATUS'; rowId: string; status: ComparisonRow['status'] }
  | { type: 'SET_DOCUMENT'; rowId: string; side: 'invoice' | 'receipt'; document: Document }
  | { type: 'REMOVE_DOCUMENT'; rowId: string; side: 'invoice' | 'receipt' }
  | { type: 'UPDATE_DOCUMENT'; documentId: string; updates: Partial<Document> }
  | { type: 'SET_MATCHING_PAIRS'; rowId: string; pairs: MatchingPair[] }
  | { type: 'UPDATE_PAIR'; rowId: string; pairId: string; updates: Partial<MatchingPair> }
  | { type: 'ADD_PAIR'; rowId: string; pair: MatchingPair }
  | { type: 'REMOVE_PAIR'; rowId: string; pairId: string }
  | { type: 'UPDATE_LINE_ITEM'; documentId: string; itemId: string; updates: Partial<LineItem> }
  | { type: 'ADD_LINE_ITEM'; documentId: string; item: LineItem }
  | { type: 'IMPORT_STATE'; state: AppState }
  | { type: 'RESET_STATE' };
