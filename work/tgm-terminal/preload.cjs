const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('terminalBridge', {
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  start: options => ipcRenderer.invoke('start-terminal', options),
  stop: () => ipcRenderer.invoke('stop-terminal'),
  input: data => ipcRenderer.send('terminal-input', data),
  resize: (cols, rows) => ipcRenderer.send('terminal-resize', cols, rows),
  onData: callback => ipcRenderer.on('terminal-data', (_, data) => callback(data)),
  onExit: callback => ipcRenderer.on('terminal-exit', (_, code) => callback(code)),
  copy: text => ipcRenderer.invoke('clipboard-write', text),
  paste: () => ipcRenderer.invoke('clipboard-read')
});
