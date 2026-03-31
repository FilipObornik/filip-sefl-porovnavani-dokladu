import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  saveFileDialog: (defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName),
  openFileDialog: (filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),
  setSettings: (settings: {
    apiKey: string;
    selectedModel: string;
    customModels: { id: string; name: string }[];
    toleranceExtraction: number;
    toleranceTotal: number;
    toleranceItem: number;
  }) => ipcRenderer.invoke('settings:set', settings),

  // Usage log
  logUsage: (entry: {
    id: string;
    timestamp: string;
    rowId: string;
    documentId: string;
    documentLabel: string;
    requestType: 'invoice' | 'receipt';
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUSD: number;
  }) => ipcRenderer.invoke('usage:log', entry),
  getUsageLog: () =>
    ipcRenderer.invoke('usage:get'),

  // File write
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('file:write', filePath, content),

  // App close
  onWillClose: (cb: () => void) =>
    ipcRenderer.on('app:will-close', () => cb()),
  confirmClose: () =>
    ipcRenderer.invoke('app:confirm-close'),
});
