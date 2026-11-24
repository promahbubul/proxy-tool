const { spawn } = require('child_process');
const path = require('path');
const { clipboard } = require('electron');

const scriptPath = path.join(__dirname, 'scripts', 'fill.ps1');

/**
 * Executes the fill automation script
 * @param {Object} options
 * @param {string} options.host
 * @param {string} options.port
 * @param {string} options.username
 * @param {string} options.password
 * @param {string} options.mode - 'tab-sequence' | 'single-line' | 'cred-only'
 * @param {boolean} options.switchWindow - whether to trigger Alt+Tab before typing
 * @param {number} options.delayMs
 */
function executeFill(options = {}) {
  return new Promise((resolve, reject) => {
    const {
      type = 'HTTP',
      host = '',
      port = '',
      username = '',
      password = '',
      startField = 'host-with-protocol',
      mode = 'tab-sequence',
      switchWindow = false,
      delayMs = 45
    } = options;

    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-Type', type,
      '-HostVal', host,
      '-PortVal', port,
      '-UserVal', username,
      '-PassVal', password,
      '-StartField', startField,
      '-Mode', mode,
      '-DelayMs', delayMs.toString()
    ];

    if (switchWindow) {
      args.push('-SwitchToPreviousWindow');
    }

    const ps = spawn('powershell.exe', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    ps.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    ps.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        console.error('Fill script failed:', stderr);
        resolve({ success: false, error: stderr });
      }
    });

    ps.on('error', (err) => {
      console.error('Spawn error:', err);
      reject(err);
    });
  });
}

/**
 * Format proxy for one-click copy
 */
function getFormattedProxy(proxy, format = 'smart') {
  if (!proxy) return '';
  const { host = '', port = '', username = '', password = '', type = 'HTTP' } = proxy;

  if (format === 'url' || type.toUpperCase().includes('SOCKS')) {
    const proto = type.toLowerCase();
    if (username && password) {
      return `${proto}://${username}:${password}@${host}:${port}`;
    }
    return `${proto}://${host}:${port}`;
  }

  // Standard: host:port:username:password
  if (username && password) {
    return `${host}:${port}:${username}:${password}`;
  }
  return `${host}:${port}`;
}

/**
 * Copy proxy to clipboard
 */
function copyToClipboard(proxy, format = 'standard') {
  const text = getFormattedProxy(proxy, format);
  if (text) {
    clipboard.writeText(text);
    return text;
  }
  return null;
}

module.exports = {
  executeFill,
  getFormattedProxy,
  copyToClipboard
};
