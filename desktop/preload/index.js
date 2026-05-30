const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sparklearnDesktop', {
  getStatus: () => ipcRenderer.invoke('desktop:get-status'),
  openLogs: () => ipcRenderer.invoke('desktop:open-logs'),
  nanobot: {
    getConfig: () => ipcRenderer.invoke('nanobot:get-config'),
    saveConfig: (payload) => ipcRenderer.invoke('nanobot:save-config', payload),
    getStatus: () => ipcRenderer.invoke('nanobot:get-status'),
    restartGateway: () => ipcRenderer.invoke('nanobot:restart-gateway'),
    restartServe: () => ipcRenderer.invoke('nanobot:restart-serve'),
  },
});
