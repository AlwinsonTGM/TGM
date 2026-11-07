'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const tgmApi = Object.freeze({
  listCaptures() {
    return ipcRenderer.invoke('tgm:list-captures');
  },
  saveCapture(text) {
    return ipcRenderer.invoke('tgm:save-capture', text);
  },
  updateCapture: (id, text, goalId, projectId, revision) => ipcRenderer.invoke('tgm:update-capture', id, text, goalId, projectId, revision),
  deleteCapture: (id, revision) => ipcRenderer.invoke('tgm:delete-capture', id, revision),
  listProjects: () => ipcRenderer.invoke('tgm:list-projects'),
  createProject: (name, folder) => ipcRenderer.invoke('tgm:create-project', name, folder),
  updateProject: (id, name, folder, active) => ipcRenderer.invoke('tgm:update-project', id, name, folder, active),
  listGoals() {
    return ipcRenderer.invoke('tgm:list-goals');
  },
  createGoal(title, firstStep) {
    return ipcRenderer.invoke('tgm:create-goal', title, firstStep);
  },
  saveGoalDetails(goalId, title, stepId, stepText, expectedTitle, expectedStep) {
    return ipcRenderer.invoke('tgm:save-goal-details', goalId, title, stepId, stepText, expectedTitle, expectedStep);
  },
  listCompletedSteps: () => ipcRenderer.invoke('tgm:list-completed-steps'),
  completeStep: (goalId, stepId, expectedText) => ipcRenderer.invoke('tgm:complete-step', goalId, stepId, expectedText),
  restoreStep: (goalId, stepId) => ipcRenderer.invoke('tgm:restore-step', goalId, stepId),
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
