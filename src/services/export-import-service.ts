import { AppState, ExportData } from '@/state/types';

export function exportState(state: AppState): ExportData {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    invoices: state.invoices,
    receipts: state.receipts,
    comparisonRows: state.comparisonRows,
  };
}

export function importState(json: string): AppState {
  const data: ExportData = JSON.parse(json);

  if (!data.version || !Array.isArray(data.invoices) || !Array.isArray(data.receipts)) {
    throw new Error('Neplatný formát souboru');
  }

  return {
    invoices: data.invoices || [],
    receipts: data.receipts || [],
    comparisonRows: data.comparisonRows || [],
  };
}

export function downloadJson(data: ExportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `porovnani-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readJsonFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Nepodařilo se přečíst soubor'));
    reader.readAsText(file);
  });
}
