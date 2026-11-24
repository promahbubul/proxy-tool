const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const store = require('./storage');
const autofill = require('./autofill');

let dashboardWindow = null;
let overlayWindow = null;
let tray = null;

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 1060,
    height: 720,
    minWidth: 800,
    minHeight: 550,
    backgroundColor: '#0f172a',
    title: 'SmartFill Pro - Dashboard & Proxy Hub',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  dashboardWindow.loadFile(path.join(__dirname, '../renderer/dashboard/index.html'));

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 530,
    height: 74,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Keep on top of all windows
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true);

  overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function syncWindows(channel, data) {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send(channel, data);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, data);
  }
}

function getActiveProxies() {
  const proxies = store.getProxies();
  const isDone = (p) => p.status === 'done' || p.status === 'used' || p.status === 'inactive';
  return proxies.filter(p => !isDone(p));
}

function getCurrentActiveProxy() {
  const activeProxies = getActiveProxies();
  if (activeProxies.length === 0) return null;

  const settings = store.getSettings();
  if (settings.activeProxyId) {
    const found = activeProxies.find(p => p.id === settings.activeProxyId);
    if (found) return found;
  }

  let idx = settings.activeProxyIndex || 0;
  if (idx < 0 || idx >= activeProxies.length) idx = 0;
  const current = activeProxies[idx];
  if (current) {
    store.updateSettings({ activeProxyId: current.id, activeProxyIndex: idx });
  }
  return current;
}

function registerHotkeys() {
  globalShortcut.unregisterAll();

  const settings = store.getSettings();
  const fillHotkey = settings.globalHotkey || 'Alt+F';
  const copyHotkey = settings.copyHotkey || 'Alt+C';
  const nextHotkey = settings.nextHotkey || 'Alt+N';

  // Hotkey: Auto-Fill (Alt+F)
  try {
    globalShortcut.register(fillHotkey, async () => {
      await triggerActiveFill(false);
    });
  } catch (err) {
    console.warn(`Failed to register hotkey ${fillHotkey}:`, err);
  }

  // Hotkey: Copy active proxy (Alt+C)
  try {
    globalShortcut.register(copyHotkey, () => {
      const current = getCurrentActiveProxy();
      if (current) {
        const text = autofill.copyToClipboard(current);
        syncWindows('notify', { message: `Copied: ${text}`, type: 'success' });
      } else {
        syncWindows('notify', { message: 'No active proxy to copy!', type: 'error' });
      }
    });
  } catch (err) {}

  // Hotkey: Next proxy (Alt+N)
  try {
    globalShortcut.register(nextHotkey, () => {
      advanceProxy(1);
    });
  } catch (err) {}

  // Hotkey: Toggle Done / Active (Alt+D)
  try {
    globalShortcut.register('Alt+D', () => {
      toggleCurrentProxyDone();
    });
  } catch (err) {}
}

function toggleCurrentProxyDone() {
  const current = getCurrentActiveProxy();
  if (!current) {
    syncWindows('notify', { message: 'No active proxy to mark done!', type: 'info' });
    return;
  }

  // Mark done -> removes from active list!
  store.toggleProxyStatus(current.id);
  const remaining = getActiveProxies();
  const nextProxy = remaining[0] || null;

  store.updateSettings({
    activeProxyId: nextProxy ? nextProxy.id : null,
    activeProxyIndex: 0
  });

  syncWindows('store-updated', store.getAll());
  syncWindows('notify', {
    message: `Marked as Inactive! (${remaining.length} active remaining in toolbar)`,
    type: 'info'
  });
}

async function triggerActiveFill(fromOverlayClick = false) {
  const current = getCurrentActiveProxy();

  if (!current) {
    syncWindows('notify', { message: 'All proxies have been used! List is empty.', type: 'error' });
    return;
  }

  const settings = store.getSettings();
  const targetBrowser = settings.targetBrowser || 'geelark';
  syncWindows('notify', { message: `Filling [${targetBrowser.toUpperCase()}]: ${current.host}:${current.port}...`, type: 'info' });

  // Execute fill
  const res = await autofill.executeFill({
    type: current.type || 'HTTP',
    host: current.host,
    port: current.port,
    username: current.username,
    password: current.password,
    browser: targetBrowser,
    startField: settings.startField || 'dropdown',
    mode: settings.fillMode || 'tab-sequence',
    switchWindow: fromOverlayClick, // If clicked from overlay, Alt+Tab back to target
    delayMs: settings.fillDelayMs || 45
  });

  if (res.success) {
    // Mark as used / done -> removes from toolbar list!
    store.markProxyUsed(current.id);

    const remaining = getActiveProxies();
    const nextProxy = remaining[0] || null;

    store.updateSettings({
      activeProxyId: nextProxy ? nextProxy.id : null,
      activeProxyIndex: 0
    });
    syncWindows('store-updated', store.getAll());

    syncWindows('notify', {
      message: `Proxy filled & moved to Inactive! (${remaining.length} active remaining)`,
      type: 'success'
    });
  } else {
    syncWindows('notify', { message: `Fill failed: ${res.error || 'Unknown error'}`, type: 'error' });
  }
}

function advanceProxy(step = 1) {
  const activeProxies = getActiveProxies();
  if (activeProxies.length === 0) return;

  const current = getCurrentActiveProxy();
  let currentIdx = activeProxies.findIndex(p => p.id === (current ? current.id : null));
  if (currentIdx === -1) currentIdx = 0;

  const nextIdx = (currentIdx + step + activeProxies.length) % activeProxies.length;
  const nextProxy = activeProxies[nextIdx];

  store.updateSettings({
    activeProxyId: nextProxy ? nextProxy.id : null,
    activeProxyIndex: nextIdx
  });
  syncWindows('store-updated', store.getAll());
}

function setupTray() {
  try {
    // Generate simple tray icon or blank image if icon not yet ready
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setToolTip('SmartFill Overlay - Active');
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Dashboard', click: () => createDashboardWindow() },
      { label: 'Toggle Overlay', click: () => {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show();
          } else {
            createOverlayWindow();
          }
        }
      },
      { type: 'separator' },
      { label: 'Fill Current (Alt+F)', click: () => triggerActiveFill(true) },
      { label: 'Next Proxy (Alt+N)', click: () => advanceProxy(1) },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
  } catch (e) {
    console.warn('Tray init skipped:', e);
  }
}

app.whenReady().then(() => {
  createDashboardWindow();
  createOverlayWindow();
  setupTray();
  registerHotkeys();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDashboardWindow();
      createOverlayWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Communication
ipcMain.handle('get-store', () => store.getAll());

ipcMain.handle('update-settings', (event, newSettings) => {
  const updated = store.updateSettings(newSettings);
  registerHotkeys();
  syncWindows('store-updated', store.getAll());
  return updated;
});

ipcMain.handle('add-proxy', (event, proxyData) => {
  const item = store.addProxy(proxyData);
  syncWindows('store-updated', store.getAll());
  return item;
});

ipcMain.handle('update-proxy', (event, { id, updates }) => {
  const item = store.updateProxy(id, updates);
  syncWindows('store-updated', store.getAll());
  return item;
});

ipcMain.handle('delete-proxy', (event, id) => {
  const res = store.deleteProxy(id);
  syncWindows('store-updated', store.getAll());
  return res;
});

ipcMain.handle('delete-proxies-bulk', (event, ids) => {
  const res = store.deleteProxiesBulk(ids);
  syncWindows('store-updated', store.getAll());
  return res;
});

ipcMain.handle('toggle-proxy-status', (event, id) => {
  if (!id) {
    toggleCurrentProxyDone();
    return true;
  }
  const item = store.toggleProxyStatus(id);
  const activeProxies = getActiveProxies();
  const settings = store.getSettings();

  // If the toggled proxy was the active one and became inactive, select the next active proxy
  const isDone = item && (item.status === 'done' || item.status === 'used' || item.status === 'inactive');
  if (isDone && settings.activeProxyId === id) {
    const nextProxy = activeProxies[0] || null;
    store.updateSettings({
      activeProxyId: nextProxy ? nextProxy.id : null,
      activeProxyIndex: 0
    });
  } else if (!isDone && (!settings.activeProxyId || activeProxies.length === 1)) {
    // If reactivated and no active proxy was selected, make this the current one
    store.updateSettings({
      activeProxyId: item.id,
      activeProxyIndex: 0
    });
  }

  syncWindows('store-updated', store.getAll());
  return item;
});

ipcMain.handle('set-proxies-status-bulk', (event, { ids, status }) => {
  const res = store.setProxiesStatusBulk(ids, status);
  syncWindows('store-updated', store.getAll());
  return res;
});

ipcMain.handle('save-csv-file', async (event, csvContent) => {
  const fs = require('fs');
  const { canceled, filePath } = await dialog.showSaveDialog(dashboardWindow || null, {
    title: 'Export Proxies CSV',
    defaultPath: 'proxies_export.csv',
    filters: [
      { name: 'CSV Files (*.csv)', extensions: ['csv'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ]
  });
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, csvContent, 'utf8');
    return { success: true, filePath };
  }
  return { canceled: true };
});

ipcMain.handle('clear-proxies', () => {
  store.clearAllProxies();
  syncWindows('store-updated', store.getAll());
  return true;
});

ipcMain.handle('import-proxies', (event, { text, defaultType = 'SOCKS5' }) => {
  const content = typeof text === 'string' ? text : (event.text || text);
  const proto = defaultType || 'SOCKS5';
  const added = store.importProxiesFromText(content, proto);
  syncWindows('store-updated', store.getAll());
  return added;
});

ipcMain.handle('toggle-proxy-type', (event, id) => {
  const item = store.toggleProxyType(id);
  syncWindows('store-updated', store.getAll());
  return item;
});

ipcMain.handle('set-active-proxy', (event, id) => {
  const proxies = store.getProxies();
  const target = proxies.find(p => p.id === id);
  if (!target) return false;

  const isDone = (p) => p.status === 'done' || p.status === 'used' || p.status === 'inactive';
  if (isDone(target)) {
    store.toggleProxyStatus(target.id);
  }

  const activeProxies = getActiveProxies();
  let idx = activeProxies.findIndex(p => p.id === id);
  if (idx === -1) idx = 0;

  store.updateSettings({
    activeProxyId: id,
    activeProxyIndex: idx
  });
  syncWindows('store-updated', store.getAll());
  return true;
});

ipcMain.handle('set-active-index', (event, index) => {
  const activeProxies = getActiveProxies();
  let idx = typeof index === 'number' ? index : 0;
  if (idx < 0 || idx >= activeProxies.length) idx = 0;
  const target = activeProxies[idx];

  store.updateSettings({
    activeProxyIndex: idx,
    activeProxyId: target ? target.id : null
  });
  syncWindows('store-updated', store.getAll());
  return true;
});

ipcMain.handle('next-proxy', () => {
  advanceProxy(1);
  return true;
});

ipcMain.handle('prev-proxy', () => {
  advanceProxy(-1);
  return true;
});

ipcMain.handle('trigger-fill', async (event, { fromOverlay = true }) => {
  await triggerActiveFill(fromOverlay);
  return true;
});

ipcMain.handle('copy-current', () => {
  const current = getCurrentActiveProxy();
  if (current) {
    const text = autofill.copyToClipboard(current);
    syncWindows('notify', { message: `Copied: ${text}`, type: 'success' });
    return text;
  }
  return null;
});

ipcMain.handle('set-target-browser', (event, browser) => {
  store.updateSettings({ targetBrowser: browser });
  syncWindows('store-updated', store.getAll());
  return browser;
});

ipcMain.handle('open-dashboard', () => {
  createDashboardWindow();
  return true;
});

ipcMain.handle('close-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
});
