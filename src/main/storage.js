const fs = require('fs');
const path = require('path');
let app = null;
try {
  const electron = require('electron');
  if (typeof electron === 'object' && electron.app) {
    app = electron.app;
  }
} catch (e) {}

class DataStore {
  constructor() {
    this.userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../data');
    this.dataFile = path.join(this.userDataPath, 'store.json');
    this.ensureDirectoryExists();
    this.state = this.loadData();
  }

  ensureDirectoryExists() {
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading data file:', err);
    }

    return {
      proxies: [
        {
          id: 'demo-1',
          name: 'US Residential 01',
          type: 'HTTP',
          host: '198.51.100.12',
          port: '8080',
          username: 'user_alpha',
          password: 'pass_secret_123',
          tags: ['USA', 'Chrome'],
          status: 'ready',
          usedCount: 0,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-2',
          name: 'UK Mobile 02',
          type: 'SOCKS5',
          host: '203.0.113.45',
          port: '1080',
          username: 'user_bravo',
          password: 'pass_secret_456',
          tags: ['UK', 'GeeLark'],
          status: 'ready',
          usedCount: 0,
          createdAt: new Date().toISOString()
        }
      ],
      credentials: [
        {
          id: 'cred-1',
          name: 'Gmail Account 1',
          username: 'john.doe.workspace@gmail.com',
          password: 'superpassword99#',
          secret2fa: 'JBSWY3DPEHPK3PXP',
          notes: 'GoLogin Profile 1'
        }
      ],
      settings: {
        globalHotkey: 'Alt+F',
        copyHotkey: 'Alt+C',
        nextHotkey: 'Alt+N',
        autoAdvanceOnFill: true,
        fillDelayMs: 45,
        targetBrowser: 'geelark', // 'geelark' | 'smart' | 'gologin' | 'adspower' | 'dolphin' | 'universal'
        fillMode: 'tab-sequence', // 'tab-sequence' | 'single-line'
        startField: 'dropdown', // 'dropdown' (cursor in dropdown) | 'host-only' (cursor in IP box)
        activeProxyIndex: 0
      }
    };
  }

  saveData() {
    try {
      this.ensureDirectoryExists();
      fs.writeFileSync(this.dataFile, JSON.stringify(this.state, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Error saving data file:', err);
      return false;
    }
  }

  getAll() {
    return this.state;
  }

  getProxies() {
    return this.state.proxies || [];
  }

  getCredentials() {
    return this.state.credentials || [];
  }

  getSettings() {
    return this.state.settings || {};
  }

  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.saveData();
    return this.state.settings;
  }

  addProxy(proxy) {
    const item = {
      id: proxy.id || 'prx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name: proxy.name || `Proxy ${this.state.proxies.length + 1}`,
      type: (proxy.type || 'HTTP').toUpperCase(),
      host: (proxy.host || '').trim(),
      port: (proxy.port || '').trim(),
      username: (proxy.username || '').trim(),
      password: (proxy.password || '').trim(),
      tags: Array.isArray(proxy.tags) ? proxy.tags : (proxy.tags ? proxy.tags.split(',').map(s => s.trim()) : []),
      status: proxy.status || 'ready',
      usedCount: proxy.usedCount || 0,
      createdAt: proxy.createdAt || new Date().toISOString()
    };
    this.state.proxies.push(item);
    this.saveData();
    return item;
  }

  updateProxy(id, updates) {
    const idx = this.state.proxies.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.state.proxies[idx] = { ...this.state.proxies[idx], ...updates };
      this.saveData();
      return this.state.proxies[idx];
    }
    return null;
  }

  deleteProxy(id) {
    this.state.proxies = this.state.proxies.filter(p => p.id !== id);
    if (this.state.settings.activeProxyIndex >= this.state.proxies.length) {
      this.state.settings.activeProxyIndex = Math.max(0, this.state.proxies.length - 1);
    }
    this.saveData();
    return true;
  }

  deleteProxiesBulk(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return true;
    const idSet = new Set(ids);
    this.state.proxies = this.state.proxies.filter(p => !idSet.has(p.id));
    if (this.state.settings.activeProxyIndex >= this.state.proxies.length) {
      this.state.settings.activeProxyIndex = Math.max(0, this.state.proxies.length - 1);
    }
    this.saveData();
    return true;
  }

  clearAllProxies() {
    this.state.proxies = [];
    this.state.settings.activeProxyIndex = 0;
    this.saveData();
    return true;
  }

  markProxyUsed(id) {
    const proxy = this.state.proxies.find(p => p.id === id);
    if (proxy) {
      proxy.usedCount = (proxy.usedCount || 0) + 1;
      proxy.status = 'done';
      proxy.lastUsedAt = new Date().toISOString();
      this.saveData();
      return proxy;
    }
    return null;
  }

  toggleProxyStatus(id) {
    const proxy = this.state.proxies.find(p => p.id === id);
    if (proxy) {
      const isCurrentlyDone = proxy.status === 'done' || proxy.status === 'used' || proxy.status === 'inactive';
      if (isCurrentlyDone) {
        proxy.status = 'active';
      } else {
        proxy.status = 'done';
        proxy.lastUsedAt = new Date().toISOString();
      }
      this.saveData();
      return proxy;
    }
    return null;
  }

  setProxiesStatusBulk(ids, newStatus) {
    if (!Array.isArray(ids) || ids.length === 0) return true;
    const idSet = new Set(ids);
    this.state.proxies.forEach(p => {
      if (idSet.has(p.id)) {
        p.status = newStatus;
        if (newStatus === 'done') {
          p.lastUsedAt = new Date().toISOString();
        }
      }
    });
    this.saveData();
    return true;
  }

  toggleProxyType(id) {
    const proxy = this.state.proxies.find(p => p.id === id);
    if (proxy) {
      proxy.type = (proxy.type || 'HTTP').toUpperCase() === 'SOCKS5' ? 'HTTP' : 'SOCKS5';
      this.saveData();
      return proxy;
    }
    return null;
  }

  /**
   * Smart parse raw lines or CSV rows
   * Supports:
   * 1. Standard CSV: host,port,user,pass,type,name
   * 2. Colon separated: host:port:user:pass or host:port
   * 3. SOCKS5/HTTP URL: http://user:pass@host:port
   */
  importProxiesFromText(text, defaultType = 'SOCKS5') {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const added = [];

    for (let line of lines) {
      // Check if it's a URL like http://user:pass@host:port
      if (line.includes('://')) {
        try {
          const url = new URL(line);
          const type = url.protocol.replace(':', '').toUpperCase();
          const host = url.hostname;
          const port = url.port;
          const username = decodeURIComponent(url.username || '');
          const password = decodeURIComponent(url.password || '');
          if (host && port) {
            added.push(this.addProxy({
              type: type === 'SOCKS' ? 'SOCKS5' : type,
              host,
              port,
              username,
              password,
              tags: ['Imported-URL']
            }));
            continue;
          }
        } catch (e) {}
      }

      // Check if comma-separated or tab-separated
      let parts = line.split(/[,\t]/);
      if (parts.length >= 2 && !line.includes(':')) {
        // e.g. host, port, user, pass
        const [host, port, username, password, type] = parts.map(p => p.trim());
        if (host && port) {
          added.push(this.addProxy({
            host,
            port,
            username: username || '',
            password: password || '',
            type: type || defaultType || 'SOCKS5',
            tags: ['Imported-CSV']
          }));
          continue;
        }
      }

      // Colon-separated: host:port:username:password OR host:port
      const colonParts = line.split(':').map(p => p.trim());
      if (colonParts.length >= 2) {
        let host = colonParts[0];
        let port = colonParts[1];
        let username = colonParts[2] || '';
        let password = colonParts.length > 3 ? colonParts.slice(3).join(':') : '';
        
        // Sometimes format is username:password@host:port
        if (line.includes('@')) {
          const [auth, hostport] = line.split('@');
          const [u, p] = auth.split(':');
          const [h, prt] = hostport.split(':');
          host = h;
          port = prt;
          username = u;
          password = p;
        }

        if (host && port) {
          added.push(this.addProxy({
            host,
            port,
            username,
            password,
            type: defaultType || 'SOCKS5',
            tags: ['Imported']
          }));
        }
      }
    }

    return added;
  }
}

module.exports = new DataStore();
