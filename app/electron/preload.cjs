'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const tgmApi = Object.freeze({
  listCaptures() {
    return ipcRenderer.invoke('tgm:list-captures');
  },
  saveCapture(text) {
    return ipcRenderer.invoke('tgm:save-capture', text);
  },
  listGoals() {
    return ipcRenderer.invoke('tgm:list-goals');
  },
  createGoal(title, firstStep) {
    return ipcRenderer.invoke('tgm:create-goal', title, firstStep);
  },
  saveGoalDetails(goalId, title, stepId, stepText, expectedTitle, expectedStep) {
    return ipcRenderer.invoke('tgm:save-goal-details', goalId, title, stepId, stepText, expectedTitle, expectedStep);
  },
});

contextBridge.exposeInMainWorld('tgm', tgmApi);


function subscribe(channel, callback) {
  if (typeof callback !== 'function') throw new TypeError('Listener must be a function.');
  const listener = (_, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('terminalBridge', Object.freeze({
  chooseFolder: () => ipcRenderer.invoke('terminal:choose-folder'),
  checkHarness: id => ipcRenderer.invoke('terminal:check-harness', id),
  start: options => ipcRenderer.invoke('terminal:start', options),
  write: data => ipcRenderer.send('terminal:input', data),
  resize: (cols, rows) => ipcRenderer.send('terminal:resize', cols, rows),
  stop: () => ipcRenderer.invoke('terminal:stop'),
  onData: callback => subscribe('terminal:data', callback),
  onExit: callback => subscribe('terminal:exit', callback),
  copy: text => ipcRenderer.invoke('terminal:clipboard-write', text),
  paste: () => ipcRenderer.invoke('terminal:clipboard-read'),
}));
