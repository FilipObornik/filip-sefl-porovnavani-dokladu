import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from '@/state/app-context';
import { exportState } from '@/services/export-import-service';

function getElectronAPI() {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).electronAPI) {
    return (window as unknown as { electronAPI: {
      saveFileDialog: (defaultName: string) => Promise<string | null>;
      writeFile: (filePath: string, content: string) => Promise<void>;
      onWillClose: (cb: () => void) => void;
      confirmClose: () => Promise<void>;
    } }).electronAPI;
  }
  return null;
}

export default function CloseGuard() {
  const { state } = useAppContext();
  const [showDialog, setShowDialog] = useState(false);
  const rowCountRef = useRef(0);
  const stateRef = useRef(state);

  // Keep refs in sync with latest state
  useEffect(() => {
    rowCountRef.current = state.comparisonRows.length;
    stateRef.current = state;
  });

  // Register IPC listener once on mount
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;
    api.onWillClose(() => {
      if (rowCountRef.current === 0) {
        api.confirmClose();
      } else {
        setShowDialog(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveAndClose = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) return;

    const defaultName = `porovnani-export-${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = await api.saveFileDialog(defaultName);
    if (!filePath) return; // uživatel zrušil dialog → app zůstane otevřená

    const data = exportState(stateRef.current);
    await api.writeFile(filePath, JSON.stringify(data, null, 2));
    setShowDialog(false);
    await api.confirmClose();
  }, []);

  const handleCloseWithoutSave = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) return;
    setShowDialog(false);
    await api.confirmClose();
  }, []);

  if (!showDialog || typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Zavřít aplikaci</h2>
        <p className="text-sm text-gray-600 mb-6">
          Máte neuloženou práci. Chcete uložit postup před zavřením?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSaveAndClose}
            className="w-full py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Uložit postup a zavřít
          </button>
          <button
            onClick={handleCloseWithoutSave}
            className="w-full py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Zavřít bez uložení postupu
          </button>
          <button
            onClick={() => setShowDialog(false)}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
