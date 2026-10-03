const syncService = {
  get serverUrl() {
    return localStorage.getItem('sync_serverUrl') || '';
  },
  get pairToken() {
    return localStorage.getItem('sync_pairToken') || '';
  },
  get lastSyncTimestamp() {
    return localStorage.getItem('sync_lastTimestamp') || null;
  },

  setServerConfig(url, token) {
    localStorage.setItem('sync_serverUrl', url);
    localStorage.setItem('sync_pairToken', token);
  },

  getServerConfig() {
    return {
      serverUrl: this.serverUrl,
      pairToken: this.pairToken,
      lastSyncTimestamp: this.lastSyncTimestamp
    };
  },

  async checkConnection() {
    if (!this.serverUrl) return { isOnline: false, storeName: '' };
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.serverUrl}/api/sync/ping`, {
        signal: controller.signal,
        headers: { 'X-Sync-Token': this.pairToken }
      });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json();
        return { isOnline: true, storeName: data.store_name || data.storeName || 'Tienda POS' };
      }
    } catch (err) {
      console.warn('Sync ping failed:', err);
    }
    return { isOnline: false, storeName: '' };
  },

  async syncSales(sales) {
    if (!this.serverUrl) return false;
    try {
      const res = await fetch(`${this.serverUrl}/api/sync/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Token': this.pairToken
        },
        body: JSON.stringify(sales)
      });
      return res.ok;
    } catch (err) {
      console.error('Failed to sync sales:', err);
      return false;
    }
  },

  async pullCatalog() {
    if (!this.serverUrl) return null;
    try {
      const since = this.lastSyncTimestamp || 0;
      const res = await fetch(`${this.serverUrl}/api/sync/catalog?since=${since}`, {
        headers: { 'X-Sync-Token': this.pairToken }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('Failed to pull catalog:', err);
    }
    return null;
  },

  async syncNow() {
    const status = await this.checkConnection();
    if (!status.isOnline) return false;
    
    // Simulate full cycle
    const catalog = await this.pullCatalog();
    if (catalog) {
        // Store catalog locally ...
    }
    
    localStorage.setItem('sync_lastTimestamp', Date.now().toString());
    
    // Dispatch event for UI
    window.dispatchEvent(new CustomEvent('sync-status-changed', {
      detail: { isConnected: true, lastSyncTime: Date.now(), pendingCount: 0 }
    }));
    return true;
  },

  async fetchLocal(path, data = {}, method = 'GET') {
    const url = new URL(`${this.serverUrl || 'http://localhost'}${path}`);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Token': this.pairToken
      }
    };
    if (method === 'GET') {
      Object.keys(data).forEach(key => url.searchParams.append(key, data[key]));
    } else {
      options.body = JSON.stringify(data);
    }
    
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
    } catch(err) {
      console.error(`Local fetch failed for ${path}:`, err);
    }
    return null;
  }
};

export default syncService;
