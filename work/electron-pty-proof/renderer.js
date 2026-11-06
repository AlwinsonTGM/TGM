try {
  const term = new Terminal({ cols: 80, rows: 24 });
  term.open(document.getElementById('terminal'));
  term.onData(data => window.probe.input(data));
  window.probe.onData(data => term.write(data, () => {
    const lines = Array.from({ length: term.buffer.active.length }, (_, i) => term.buffer.active.getLine(i)?.translateToString(true) || '');
    if (lines.some(line => line.trim() === 'ELECTRON_PTY_RENDER_OK')) window.probe.verified('actual Electron renderer accepted terminal input and rendered synthetic shell output');
  }));
  window.probe.onReady(() => term.input('echo ELECTRON_PTY_RENDER_OK\r', true));
  window.probe.start();
} catch (error) { window.probe.failed(error.stack); }
