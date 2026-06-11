const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sparklearnDesktop', {
  getStatus: () => ipcRenderer.invoke('desktop:get-status'),
  openLogs: () => ipcRenderer.invoke('desktop:open-logs'),
  openStudyBuddyConfig: () => ipcRenderer.invoke('desktop:studybuddy-config:open'),
  getStudyBuddyConfig: () => ipcRenderer.invoke('desktop:studybuddy-config:get'),
  saveStudyBuddyConfig: (payload) => ipcRenderer.invoke('desktop:studybuddy-config:save', payload),
  openStudyBuddyConfigFile: () => ipcRenderer.invoke('desktop:studybuddy-config:open-file'),
  getAuthSession: () => ipcRenderer.invoke('desktop:auth:get'),
  saveAuthSession: (payload) => ipcRenderer.invoke('desktop:auth:save', payload),
  clearAuthSession: () => ipcRenderer.invoke('desktop:auth:clear'),
  syncStudyBuddyProfile: (payload) => ipcRenderer.invoke('desktop:studybuddy-profile:sync', payload),
});
