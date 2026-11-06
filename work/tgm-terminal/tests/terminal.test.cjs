const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const path = require('node:path');
const { app } = require('electron');
const { TerminalSession } = require('../terminal.cjs');

function waitFor(session, predicate) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => { session.off('data', onData); reject(new Error('Timed out waiting for terminal output')); }, 10000);
    const onData = data => { output += data; if (predicate(output)) { clearTimeout(timer); session.off('data', onData); resolve(output); } };
    session.on('data', onData);
  });
}

app.whenReady().then(async () => {
  const session = new TerminalSession();
  const control = spawn('node', ['-e', 'setInterval(() => {}, 1000)'], { windowsHide: true, stdio: 'ignore' });
  try {
  session.start(process.env.ComSpec || 'cmd.exe', ['/d', '/q'], process.cwd(), 80, 24);
  const pid = session.child.pid;
  assert.throws(() => session.start('cmd.exe', [], process.cwd(), 80, 24), /already running/);
  const output = waitFor(session, text => text.includes('TGM_TEST_MARKER'));
  session.resize(100, 35);
  session.write('node -p "[\'TGM\',\'TEST\',\'MARKER\'].join(\'_\')"\r');
  await output;
  const dimensions = waitFor(session, text => text.includes('100x35'));
  session.write('node -p "process.stdout.columns+\'x\'+process.stdout.rows"\r');
  await dimensions;
  const tree = waitFor(session, text => /TREE_READY:\d+:\d+/.test(text));
  session.write(`node "${path.join(__dirname, 'process-tree.cjs')}"\r`);
  const treeOutput = await tree;
  const [, childPid, grandchildPid] = treeOutput.match(/TREE_READY:(\d+):(\d+)/).map(Number);
  const exists = id => execFileSync('tasklist.exe', ['/fi', `PID eq ${id}`, '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).includes(`"${id}"`);
  assert.ok(exists(childPid) && exists(grandchildPid), 'Expected disposable descendant processes to be running');
  assert.ok(exists(control.pid), 'Expected unrelated control process to be running');
  const stopping = session.stop();
  assert.throws(() => session.start('cmd.exe', [], process.cwd(), 80, 24), /stopping/);
  await stopping;
  assert.equal(session.child, null);
  for (const id of [pid, childPid, grandchildPid]) assert.ok(!exists(id), `Terminal tree PID ${id} still exists`);
  assert.ok(exists(control.pid), 'Stopping the terminal killed an unrelated process');
  session.start(process.env.ComSpec || 'cmd.exe', ['/d', '/q'], process.cwd(), 80, 24);
  const next = waitFor(session, text => text.includes('TGM_RESTART_MARKER'));
  session.write('node -p "[\'TGM\',\'RESTART\',\'MARKER\'].join(\'_\')"\r');
  await next;
  await session.stop();
  console.log('PASS: input, output, resize, descendant cleanup, unrelated process, and restart');
  } finally {
    await session.stop();
    control.kill();
  }
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
