const bridge = window.terminalBridge;
const term = new Terminal({ cursorBlink: true, fontSize: 14, fontFamily: 'Cascadia Mono, Consolas, monospace', theme: { background: '#0b0e0c', foreground: '#e9eeeb' } });
const fit = new FitAddon.FitAddon();
term.loadAddon(fit);
term.open(document.getElementById('terminal'));
const harness = document.getElementById('harness');
const folder = document.getElementById('folder');
const folderName = document.getElementById('folder-name');
const start = document.getElementById('start');
const stop = document.getElementById('stop');
const status = document.getElementById('status');
const error = document.getElementById('error');
const availability = document.getElementById('harness-availability');
let cwd = null;
let running = false;
let busy = false;
let exitedWhileStarting = false;
let availabilityRequest = 0;

async function checkHarness() {
  const request = ++availabilityRequest;
  const selected = harness.value;
  availability.textContent = 'Checking harness…';
  try {
    const found = await bridge.checkHarness(selected);
    if (request !== availabilityRequest) return;
    availability.textContent = found
      ? 'Found on TGM’s PATH. Launch and sign-in are not checked.'
      : 'Not found in TGM’s absolute PATH folders. You can still try starting it. Restart TGM after changing PATH.';
  } catch {
    if (request === availabilityRequest) availability.textContent = 'Could not check the harness. You can still try starting it.';
  }
}
harness.addEventListener('change', checkHarness);
document.getElementById('check-harness').addEventListener('click', checkHarness);
checkHarness();

function controls() {
  start.disabled = !cwd || running || busy;
  stop.disabled = !running || busy;
  harness.disabled = running || busy;
  folder.disabled = running || busy;
}
function resize() {
  fit.fit();
  bridge.resize(term.cols, term.rows);
}
new ResizeObserver(resize).observe(document.getElementById('terminal'));
term.onData(data => bridge.input(data));
term.attachCustomKeyEventHandler(event => {
  if (event.type !== 'keydown' || !event.ctrlKey || !event.shiftKey) return true;
  if (event.code === 'KeyC') { if (term.hasSelection()) bridge.copy(term.getSelection()).catch(err => { error.textContent = err.message; }); return false; }
  if (event.code === 'KeyV') { bridge.paste().then(text => term.paste(text)).catch(err => { error.textContent = err.message; }); return false; }
  return true;
});
bridge.onData(data => term.write(data));
bridge.onExit(code => { if (busy && !running) exitedWhileStarting = true; running = false; status.textContent = `Exited (${code})`; controls(); });
folder.addEventListener('click', async () => {
  try { const selected = await bridge.chooseFolder(); if (selected) { cwd = selected; folderName.textContent = selected; folderName.title = selected; } error.textContent = ''; } catch (err) { error.textContent = err.message; }
  controls();
});
start.addEventListener('click', async () => {
  busy = true; controls(); error.textContent = '';
  try { exitedWhileStarting = false; fit.fit(); term.clear(); await bridge.start({ harness: harness.value, cwd, cols: term.cols, rows: term.rows }); if (!exitedWhileStarting) { running = true; status.textContent = 'Running'; term.focus(); } }
  catch (err) { error.textContent = err.message; status.textContent = 'Could not start'; }
  finally { busy = false; controls(); }
});
stop.addEventListener('click', async () => {
  busy = true; controls(); error.textContent = '';
  try { if (await bridge.stop()) { running = false; status.textContent = 'Stopped'; } }
  catch (err) { error.textContent = err.message; }
  finally { busy = false; controls(); }
});
resize();
