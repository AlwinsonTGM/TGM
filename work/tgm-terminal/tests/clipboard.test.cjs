const assert = require('node:assert/strict');
const { app, BrowserWindow, clipboard } = require('electron');
const { TerminalSession } = require('../terminal.cjs');

// Keep every original system clipboard format untouched during the test.
let testClipboard = '';
clipboard.writeText = value => { testClipboard = value; };
clipboard.readText = () => testClipboard;
let terminalInput = '';
TerminalSession.prototype.write = value => { terminalInput += value; };

function waitFor(check) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const poll = () => {
      if (check()) return resolve();
      if (Date.now() >= deadline) return reject(new Error('Timed out waiting for clipboard interaction'));
      setTimeout(poll, 25);
    };
    poll();
  });
}

app.on('browser-window-created', (_, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      await window.webContents.executeJavaScript(`new Promise(resolve => term.write('TERM_COPY_TEST', () => {
        term.select(0, 0, 14); term.focus(); resolve();
      }))`);
      assert.equal(await window.webContents.executeJavaScript('term.getSelection()'), 'TERM_COPY_TEST');
      window.focus();
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'C', modifiers: ['control', 'shift'] });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'C', modifiers: ['control', 'shift'] });
      await waitFor(() => testClipboard === 'TERM_COPY_TEST');
      testClipboard = 'TERM_PASTE_TEST';
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['control', 'shift'] });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: ['control', 'shift'] });
      await waitFor(() => terminalInput.includes('TERM_PASTE_TEST'));
      console.log('PASS: xterm selection copy and clipboard paste through Electron bridge');
      window.destroy();
      app.quit();
    } catch (error) {
      console.error(error);
      for (const win of BrowserWindow.getAllWindows()) win.destroy();
      app.exit(1);
    }
  });
});

require('../main.cjs');
