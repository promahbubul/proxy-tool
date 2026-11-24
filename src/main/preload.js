const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStore: () => ipcRenderer.invoke('get-store'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  addProxy: (proxy) => ipcRenderer.invoke('add-proxy', proxy),
  updateProxy: (id, updates) => ipcRenderer.invoke('update-proxy', { id, updates }),
  deleteProxy: (id) => ipcRenderer.invoke('delete-proxy', id),
  deleteProxiesBulk: (ids) => ipcRenderer.invoke('delete-proxies-bulk', ids),
  toggleProxyStatus: (id) => ipcRenderer.invoke('toggle-proxy-status', id),
  setProxiesStatusBulk: (ids, status) => ipcRenderer.invoke('set-proxies-status-bulk', { ids, status }),
  saveCSVFile: (csvContent) => ipcRenderer.invoke('save-csv-file', csvContent),
  clearProxies: () => ipcRenderer.invoke('clear-proxies'),
  importProxies: (text, defaultType = 'SOCKS5') => ipcRenderer.invoke('import-proxies', { text, defaultType }),
  toggleProxyType: (id) => ipcRenderer.invoke('toggle-proxy-type', id),
  setActiveIndex: (index) => ipcRenderer.invoke('set-active-index', index),
  setActiveProxy: (id) => ipcRenderer.invoke('set-active-proxy', id),
  nextProxy: () => ipcRenderer.invoke('next-proxy'),
  prevProxy: () => ipcRenderer.invoke('prev-proxy'),
  triggerFill: (fromOverlay = true) => ipcRenderer.invoke('trigger-fill', { fromOverlay }),
  copyCurrent: () => ipcRenderer.invoke('copy-current'),
  setTargetBrowser: (browser) => ipcRenderer.invoke('set-target-browser', browser),
  openDashboard: () => ipcRenderer.invoke('open-dashboard'),
  closeOverlay: () => ipcRenderer.invoke('close-overlay'),
  
  onStoreUpdated: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('store-updated', handler);
    return () => ipcRenderer.removeListener('store-updated', handler);
  },
  onNotify: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('notify', handler);
    return () => ipcRenderer.removeListener('notify', handler);
  }
});
