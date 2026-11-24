const { spawn } = require('child_process');
const path = require('path');

// Get path to electron executable
const electronPath = require('electron');

// Ensure ELECTRON_RUN_AS_NODE is stripped so Electron runs in full GUI mode
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [path.join(__dirname)], {
  env,
  stdio: 'inherit',
  windowsHide: false
});

child.on('error', (err) => {
  console.error('Failed to launch Electron:', err);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
