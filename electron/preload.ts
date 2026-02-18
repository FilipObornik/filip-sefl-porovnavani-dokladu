import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveFileDialog: (defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName),
  openFileDialog: (filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),
});
