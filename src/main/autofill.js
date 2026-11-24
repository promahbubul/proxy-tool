const { spawn } = require('child_process');
const path = require('path');
const { clipboard } = require('electron');

const scriptPath = path.join(__dirname, 'scripts', 'fill.ps1');

/**
 * Executes the fill automation script
 * @param {Object} options
 * @param {string} options.type
 * @param {string} options.host
 * @param {string} options.port
 * @param {string} options.username
 * @param {string} options.password
 * @param {string} options.browser - 'gologin' | 'geelark' | 'geelark-host' | 'adspower' | 'dolphin' | 'universal'
 * @param {string} options.startField - 'dropdown' | 'host-only' | 'paste-url'
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
      browser = 'geelark',
      startField = 'dropdown',
      mode = 'tab-sequence',
      switchWindow = false,
      delayMs = 45
    } = options;

    const payloadObj = {
      type,
      host,
      port,
      username,
      password,
      browser,
      startField,
      mode,
      delayMs,
      switchWindow
    };

    const env = {
      ...process.env,
      SMARTFILL_PAYLOAD: JSON.stringify(payloadObj)
    };

    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ];

    const ps = spawn('powershell.exe', args, {
      windowsHide: true,
      env,
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
