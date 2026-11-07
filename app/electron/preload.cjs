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
  saveGoalDetails(goalId, title, stepId, stepText) {
    return ipcRenderer.invoke('tgm:save-goal-details', goalId, title, stepId, stepText);
  },
});

contextBridge.exposeInMainWorld('tgm', tgmApi);
