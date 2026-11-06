const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('probe', {
  onData: callback => ipcRenderer.on('data', (_, data) => callback(data)),
  onReady: callback => ipcRenderer.on('ready', callback),
  input: data => ipcRenderer.send('input', data),
  capture: data => ipcRenderer.send('capture', data),
  start: () => ipcRenderer.send('start'),
  verified: message => ipcRenderer.send('verified', message),
  failed: message => ipcRenderer.send('failed', message)
});
