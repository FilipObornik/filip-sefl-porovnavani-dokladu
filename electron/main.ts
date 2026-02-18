import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

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
