'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const tgmApi = Object.freeze({
  listCaptures() {
    return ipcRenderer.invoke('tgm:list-captures');
  },
  saveCapture(text) {
    return ipcRenderer.invoke('tgm:save-capture', text);
  },
});

contextBridge.exposeInMainWorld('tgm', tgmApi);
