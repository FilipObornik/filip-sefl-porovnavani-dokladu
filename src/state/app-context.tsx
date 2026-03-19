import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AppState, ComparisonRow } from './types';
import { AppAction } from './actions';

const initialState: AppState = {
  invoices: [],
  receipts: [],
  comparisonRows: [],
};

function createEmptyRow(): ComparisonRow {
  return {
    id: uuidv4(),
    note: '',
    invoiceId: null,
    receiptId: null,
    matchingPairs: [],
    status: 'empty',
  };
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_ROW':
      return {
        ...state,
        comparisonRows: [...state.comparisonRows, createEmptyRow()],
      };

    case 'REMOVE_ROW': {
      const row = state.comparisonRows.find((r) => r.id === action.rowId);
      return {
        ...state,
        invoices: state.invoices.filter((d) => d.id !== row?.invoiceId),
        receipts: state.receipts.filter((d) => d.id !== row?.receiptId),
        comparisonRows: state.comparisonRows.filter((r) => r.id !== action.rowId),
      };
    }

    case 'UPDATE_ROW_NOTE':
      return {
        ...state,
        comparisonRows: state.comparisonRows.map((r) =>
          r.id === action.rowId ? { ...r, note: action.note } : r
        ),
      };

    case 'UPDATE_ROW_STATUS':
      return {
        ...state,
        comparisonRows: state.comparisonRows.map((r) =>
          r.id === action.rowId ? { ...r, status: action.status } : r
        ),
      };

    case 'SET_DOCUMENT': {
      const doc = action.document;
      const isInvoice = action.side === 'invoice';
      const listKey = isInvoice ? 'invoices' : 'receipts';
      const idKey = isInvoice ? 'invoiceId' : 'receiptId';

      // Remove old document if replacing
      const row = state.comparisonRows.find((r) => r.id === action.rowId);
      const oldDocId = row ? row[idKey] : null;
      const filteredDocs = state[listKey].filter((d) => d.id !== oldDocId);

      // Determine new row status
      const otherIdKey = isInvoice ? 'receiptId' : 'invoiceId';
      const hasOther = row ? row[otherIdKey] !== null : false;
      const newStatus = hasOther ? 'ready' : 'partial';

      return {
        ...state,
        [listKey]: [...filteredDocs, doc],
        comparisonRows: state.comparisonRows.map((r) =>
          r.id === action.rowId
            ? { ...r, [idKey]: doc.id, status: r.status === 'done' ? 'done' : newStatus }
            : r
        ),
      };
    }

    case 'UPDATE_DOCUMENT': {
      const updateDoc = (docs: typeof state.invoices) =>
        docs.map((d) => (d.id === action.documentId ? { ...d, ...action.updates } : d));
      return {
        ...state,
        invoices: updateDoc(state.invoices),
        receipts: updateDoc(state.receipts),
      };
    }

    case 'SET_MATCHING_PAIRS':
      return {
        ...state,
        comparisonRows: state.comparisonRows.map((r) =>
          r.id === action.rowId ? { ...r, matchingPairs: action.pairs, status: 'done' } : r
        ),
      };

    case 'UPDATE_PAIR':
      return {
        ...state,
        comparisonRows: state.comparisonRows.map((r) =>
          r.id === action.rowId
            ? {
                ...r,
                matchingPairs: r.matchingPairs.map((p) =>
                  p.id === action.pairId ? { ...p, ...action.updates } : p
                ),
              }
            : r
        ),
      };

    case 'ADD_PAIR':
      return {
        ...state,
        comparisonRows: state.comparisonRows.map((r) =>
          r.id === action.rowId
            ? { ...r, matchingPairs: [action.pair, ...r.matchingPairs] }
            : r
        ),
      };

    case 'REMOVE_PAIR':
      return {
        ...state,
        comparisonRows: state.comparisonRows.map((r) =>
          r.id === action.rowId
            ? { ...r, matchingPairs: r.matchingPairs.filter((p) => p.id !== action.pairId) }
            : r
        ),
      };

    case 'UPDATE_LINE_ITEM': {
      const updateItems = (docs: typeof state.invoices) =>
        docs.map((d) =>
          d.id === action.documentId
            ? {
                ...d,
                items: d.items.map((item) =>
                  item.id === action.itemId ? { ...item, ...action.updates } : item
                ),
              }
            : d
        );
      return {
        ...state,
        invoices: updateItems(state.invoices),
        receipts: updateItems(state.receipts),
      };
    }

    case 'ADD_LINE_ITEM': {
      const addItem = (docs: typeof state.invoices) =>
        docs.map((d) =>
          d.id === action.documentId ? { ...d, items: [...d.items, action.item] } : d
        );
      return {
        ...state,
        invoices: addItem(state.invoices),
        receipts: addItem(state.receipts),
      };
    }

    case 'IMPORT_STATE':
      return action.state;

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
