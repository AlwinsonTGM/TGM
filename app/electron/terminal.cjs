const { EventEmitter } = require('node:events');
const { execFile } = require('node:child_process');
const pty = require('node-pty');

class TerminalSession extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.exitPromise = null;
    this.stopping = null;
  }

  start(command, args, cwd, cols, rows) {
    if (this.child || this.stopping) throw new Error('A terminal session is already running or stopping.');
    const child = pty.spawn(command, args, { name: 'xterm-256color', cols, rows, cwd, env: process.env });
    this.child = child;
    this.exitPromise = new Promise(resolve => {
      child.onExit(event => {
        if (this.child === child) this.child = null;
        this.emit('exit', event);
        resolve(event);
      });
    });
    child.onData(data => this.emit('data', data));
  }

  write(data) {
    if (this.child) this.child.write(data);
  }

  resize(cols, rows) {
    if (this.child) this.child.resize(cols, rows);
  }

  async stop() {
    if (this.stopping) return this.stopping;
    if (!this.child) return;
    const child = this.child;
    const exited = this.exitPromise;
    this.stopping = (async () => {
      let treeError = null;
      if (process.platform === 'win32') {
        treeError = await new Promise(resolve => execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, timeout: 4000 }, error => resolve(error)));
        if (treeError) try { child.kill(); } catch (_) {}
      } else {
        try { child.kill(); } catch (_) {}
      }
      const exitedInTime = await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 3000))]);
      if (!exitedInTime) {
        try { child.kill(); } catch (_) {}
        const stopped = await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 2000))]);
        if (!stopped) throw new Error('The terminal process did not exit.');
      }
      if (treeError) throw new Error('The terminal exited, but its child processes could not be confirmed stopped.');
    })().finally(() => { this.stopping = null; });
    return this.stopping;
  }
}

module.exports = { TerminalSession };
