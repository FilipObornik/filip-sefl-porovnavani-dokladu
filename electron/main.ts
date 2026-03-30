import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import Store from 'electron-store';

const isDev = !app.isPackaged;

// ─── Persistent store ─────────────────────────────────────────────────────────

interface StoreSchema {
  settings: {
    apiKey: string;
    selectedModel: string;
    customModels: { id: string; name: string }[];
  };
  usageLog: Array<{
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
  }>;
}

const store = new Store<StoreSchema>({
  defaults: {
    settings: {
      apiKey: '',
      selectedModel: 'google/gemini-3-pro-preview',
      customModels: [],
    },
    usageLog: [],
  },
});

// ─── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 960,
    minWidth: 1024,
    minHeight: 768,
    title: 'Porovnání Dokladů',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3456');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'out', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── Dialog IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  return result.filePath || null;
});

ipcMain.handle('dialog:openFile', async (_event, filters: { name: string; extensions: string[] }[]) => {
  const result = await dialog.showOpenDialog({
    filters,
    properties: ['openFile'],
  });
  return result.filePaths[0] || null;
});

// ─── Settings IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', () => {
  return store.get('settings');
});

ipcMain.handle('settings:set', (_event, settings: StoreSchema['settings']) => {
  store.set('settings', settings);
});

// ─── Usage log IPC ─────────────────────────────────────────────────────────────

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

ipcMain.handle('usage:log', (_event, entry: StoreSchema['usageLog'][number]) => {
  const log = store.get('usageLog') as StoreSchema['usageLog'];
  const cutoff = new Date(Date.now() - ONE_YEAR_MS).toISOString();
  // Prune entries older than 1 year, then append new entry
  const pruned = log.filter((e) => e.timestamp >= cutoff);
  pruned.push(entry);
  store.set('usageLog', pruned);
});

ipcMain.handle('usage:get', () => {
  const log = store.get('usageLog') as StoreSchema['usageLog'];
  const cutoff = new Date(Date.now() - ONE_YEAR_MS).toISOString();
  return log.filter((e) => e.timestamp >= cutoff);
});
