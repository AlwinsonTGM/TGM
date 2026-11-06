const { spawn } = require('node:child_process');

if (process.argv[2] === 'grandchild') {
  console.log(`TREE_READY:${process.ppid}:${process.pid}`);
  setInterval(() => {}, 1000);
} else {
  spawn(process.execPath, [__filename, 'grandchild'], { stdio: 'inherit', windowsHide: true });
  setInterval(() => {}, 1000);
}
