import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import Store from 'electron-store';

const isDev = !app.isPackaged;

// ─── Custom protocol (production only) ────────────────────────────────────────
// Needed because Next.js static export uses absolute paths like /_next/static/…
// which break under the file:// protocol. We serve everything from out/ via app://

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

// ─── Persistent store ─────────────────────────────────────────────────────────

interface StoreSchema {
  settings: {
    apiKey: string;
    selectedModel: string;
    customModels: { id: string; name: string }[];
    toleranceExtraction: number;
    toleranceTotal: number;
    toleranceItem: number;
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
      selectedModel: 'google/gemini-3.1-pro-preview',
      customModels: [],
      toleranceExtraction: 5,
      toleranceTotal: 5,
      toleranceItem: 1,
    },
    usageLog: [],
  },
});

// ─── Window ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

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

  mainWindow = win;

  win.webContents.on('did-finish-load', () => {
    win.focus();
  });

  // Intercept close to allow renderer to prompt for unsaved work
  win.on('close', (e) => {
    e.preventDefault();
    win.webContents.send('app:will-close');
  });

  if (isDev) {
    win.loadURL('http://localhost:3456');
    win.webContents.openDevTools();
  } else {
    win.loadURL('app://localhost/');
  }
}

app.whenReady().then(() => {
  // Serve Next.js static export via app:// protocol.
  // Using fs directly (not net.fetch+file://) avoids Chromium's cross-protocol
  // security checks that would block subsequent in-app navigation.
  const outDir = path.join(__dirname, '..', '..', 'out');
  const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };
  const logFile = path.join(app.getPath('userData'), 'protocol-debug.log');
  const logLine = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
  };
  logLine(`=== App started, outDir: ${outDir} ===`);

  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const parts = pathname.split('/').filter((x) => x !== '').map(decodeURIComponent);
    let fullPath = parts.length === 0
      ? path.join(outDir, 'index.html')
      : path.join(outDir, ...parts);

    // isHtmlRoute must be computed BEFORE appending index.html
    const isHtmlRoute = !path.extname(fullPath);
    if (isHtmlRoute) {
      fullPath = path.join(fullPath, 'index.html');
    }

    try {
      const data = await fs.promises.readFile(fullPath);
      const mimeType = MIME_TYPES[path.extname(fullPath).toLowerCase()] ?? 'application/octet-stream';
      logLine(`OK  ${pathname} → ${fullPath}`);
      return new Response(data, { headers: { 'Content-Type': mimeType } });
    } catch {
      // SPA fallback: for HTML routes without a pre-generated file (e.g. /detail/[uuid]/),
      // serve index.html so Next.js client-side router can handle the route.
      if (isHtmlRoute) {
        logLine(`SPA ${pathname} → index.html (fallback)`);
        try {
          const indexData = await fs.promises.readFile(path.join(outDir, 'index.html'));
          return new Response(indexData, { headers: { 'Content-Type': 'text/html' } });
        } catch {
          logLine(`ERR ${pathname} → index.html fallback also failed`);
          return new Response('Not found', { status: 404 });
        }
      }
      logLine(`404 ${pathname} → ${fullPath}`);
      return new Response('Not found', { status: 404 });
    }
  });

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
  const pruned = log.filter((e) => e.timestamp >= cutoff);
  pruned.push(entry);
  store.set('usageLog', pruned);
});

ipcMain.handle('usage:get', () => {
  const log = store.get('usageLog') as StoreSchema['usageLog'];
  const cutoff = new Date(Date.now() - ONE_YEAR_MS).toISOString();
  return log.filter((e) => e.timestamp >= cutoff);
});

// ─── File write IPC ────────────────────────────────────────────────────────────

ipcMain.handle('file:write', (_event, filePath: string, content: string) => {
  fs.writeFileSync(filePath, content, 'utf-8');
});

// ─── Close IPC ─────────────────────────────────────────────────────────────────

ipcMain.handle('app:confirm-close', () => {
  if (mainWindow) {
    mainWindow.destroy();
  }
});
