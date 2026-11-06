const assert = require('node:assert/strict');
const { app, BrowserWindow, clipboard, ClipboardItem } = require('electron');
const { TerminalSession } = require('../terminal.cjs');

let input = '';
TerminalSession.prototype.write = value => { input += value; };
function waitFor(check) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const poll = async () => (await check()) ? resolve() : Date.now() >= deadline ? reject(new Error('Clipboard test timed out')) : setTimeout(poll, 25);
    poll();
  });
}

app.on('browser-window-created', (_, window) => {
  window.webContents.once('did-finish-load', async () => {
    let original;
    let attempted = false;
    try {
      const items = await clipboard.read();
      original = await Promise.all(items.map(async item => {
        const entries = await Promise.all(item.types.map(async type => [type, await item.getType(type)]));
        return new ClipboardItem(Object.fromEntries(entries));
      }));
      await window.webContents.executeJavaScript(`new Promise(resolve => term.write('TERM_WINDOWS_COPY', () => {
        term.select(0, 0, 17); term.focus(); resolve();
      }))`);
      window.focus();
      attempted = true;
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'C', modifiers: ['control', 'shift'] });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'C', modifiers: ['control', 'shift'] });
      await waitFor(async () => await clipboard.readText() === 'TERM_WINDOWS_COPY');
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['control', 'shift'] });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: ['control', 'shift'] });
      await waitFor(() => input.includes('TERM_WINDOWS_COPY'));
      assert.ok(input.includes('TERM_WINDOWS_COPY'));
      console.log('PASS: Windows clipboard copy and paste through the terminal');
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    } finally {
      if (attempted && await clipboard.readText() === 'TERM_WINDOWS_COPY') {
        if (original.length) await clipboard.write(original); else clipboard.clear();
      }
      window.destroy();
      app.exit(process.exitCode || 0);
    }
  });
});
require('../main.cjs');
