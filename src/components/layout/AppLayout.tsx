import React, { useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAppContext } from '@/state/app-context';
import {
  exportState,
  importState,
  downloadJson,
  readJsonFile,
} from '@/services/export-import-service';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { state, dispatch } = useAppContext();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const data = exportState(state);
    downloadJson(data);
  }, [state]);

  const handleImportClick = () => {
    if (state.comparisonRows.length > 0) {
      const ok = confirm('Nahráním souboru se přepíše aktuální stav. Pokračovat?');
      if (!ok) return;
    }
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const json = await readJsonFile(file);
      const importedState = importState(json);
      dispatch({ type: 'IMPORT_STATE', state: importedState });
    } catch (err) {
      alert('Nepodařilo se načíst soubor. Zkontrolujte formát.');
      console.error('Import error:', err);
    }

    e.target.value = '';
  };

  const handleAddRow = () => {
    dispatch({ type: 'ADD_ROW' });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        handleExport();
      }
      if (mod && e.key === 'o') {
        e.preventDefault();
        handleImportClick();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleExport]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">
            Porovnání Dokladů
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors border border-gray-300"
              title="Ctrl+S"
            >
              Uložit postup
            </button>

            <button
              onClick={handleImportClick}
              className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors border border-gray-300"
              title="Ctrl+O"
            >
              Nahrát postup
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />

            <button
              onClick={handleAddRow}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Přidat řádek
            </button>

            <button
              onClick={() => router.push('/settings')}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              title="Nastavení"
              aria-label="Nastavení"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-6">
        {children}
      </main>
    </div>
  );
}
