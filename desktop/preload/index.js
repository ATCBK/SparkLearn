const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sparklearnDesktop', {
  getStatus: () => ipcRenderer.invoke('desktop:get-status'),
  openLogs: () => ipcRenderer.invoke('desktop:open-logs'),
  openStudyBuddyConfig: () => ipcRenderer.invoke('desktop:studybuddy-config:open'),
  getStudyBuddyConfig: () => ipcRenderer.invoke('desktop:studybuddy-config:get'),
  saveStudyBuddyConfig: (payload) => ipcRenderer.invoke('desktop:studybuddy-config:save', payload),
  openStudyBuddyConfigFile: () => ipcRenderer.invoke('desktop:studybuddy-config:open-file'),
});
