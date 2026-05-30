const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sparklearnDesktop', {
  getStatus: () => ipcRenderer.invoke('desktop:get-status'),
  openLogs: () => ipcRenderer.invoke('desktop:open-logs'),
});
