import syncService from './syncService';

function isWails() {
  return typeof window !== 'undefined' && typeof window.go?.main?.App !== 'undefined';
}

function getLocal(key, defaultVal) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(`Error saving ${key} to localStorage:`, e);
  }
}

const apiAdapter = {
  get isWails() {
    return isWails();
  },

  // --- Products ---
  async searchBarcode(barcode) {
    if (isWails() && window.go.main.App.SearchBarcode) {
      return await window.go.main.App.SearchBarcode(barcode);
    }
    const products = getLocal('iluz_products', []);
    return products.find((p) => p.barcode === barcode && p.active !== false) || null;
  },

  async saveProduct(product) {
    if (isWails() && window.go.main.App.SaveProduct) {
      return await window.go.main.App.SaveProduct(product);
    }
    const products = getLocal('iluz_products', []);
    const p = { ...product };
    if (!p.id || p.id === 0) {
      p.id = Date.now();
      if (!p.barcode) p.barcode = `INT-${String(p.id).slice(-6)}`;
      products.push(p);
    } else {
      const idx = products.findIndex((item) => item.id === p.id);
      if (idx >= 0) products[idx] = p;
      else products.push(p);
    }
    setLocal('iluz_products', products);
    return p;
  },

  async listProducts(activeOnly = true) {
    if (isWails() && window.go.main.App.ListInventoryProducts) {
      return await window.go.main.App.ListInventoryProducts(activeOnly);
    }
    const products = getLocal('iluz_products', []);
    return activeOnly ? products.filter((p) => p.active !== false) : products;
  },

  async archiveProduct(barcode) {
    if (isWails() && window.go.main.App.ArchiveProduct) {
      return await window.go.main.App.ArchiveProduct(barcode);
    }
    const products = getLocal('iluz_products', []);
    const updated = products.map((p) => (p.barcode === barcode ? { ...p, active: false } : p));
    setLocal('iluz_products', updated);
    return true;
  },

  async restoreProduct(barcode) {
    if (isWails() && window.go.main.App.RestoreProduct) {
      return await window.go.main.App.RestoreProduct(barcode);
    }
    const products = getLocal('iluz_products', []);
    const updated = products.map((p) => (p.barcode === barcode ? { ...p, active: true } : p));
    setLocal('iluz_products', updated);
    return true;
  },

  async updateProductLocation(barcode, newLocation) {
    if (isWails() && window.go.main.App.UpdateProductLocation) {
      return await window.go.main.App.UpdateProductLocation(barcode, newLocation);
    }
    const products = getLocal('iluz_products', []);
    const updated = products.map((p) => (p.barcode === barcode ? { ...p, location: newLocation } : p));
    setLocal('iluz_products', updated);
    return true;
  },

  // --- Suppliers ---
  async listSuppliers(activeOnly = false) {
    if (isWails() && window.go.main.App.ListSuppliers) {
      return await window.go.main.App.ListSuppliers(activeOnly);
    }
    const suppliers = getLocal('iluz_suppliers', []);
    return activeOnly ? suppliers.filter((s) => s.active) : suppliers;
  },

  async saveSupplier(supplier) {
    if (isWails() && window.go.main.App.SaveSupplier) {
      return await window.go.main.App.SaveSupplier(supplier);
    }
    const suppliers = getLocal('iluz_suppliers', []);
    const s = { ...supplier };
    if (!s.id || s.id === 0) {
      s.id = Date.now();
      s.createdAt = new Date().toISOString();
      s.updatedAt = new Date().toISOString();
      suppliers.push(s);
    } else {
      s.updatedAt = new Date().toISOString();
      const idx = suppliers.findIndex((item) => item.id === s.id);
      if (idx >= 0) suppliers[idx] = s;
      else suppliers.push(s);
    }
    setLocal('iluz_suppliers', suppliers);
    return s;
  },

  async deleteSupplier(supplierId) {
    if (isWails() && window.go.main.App.DeleteSupplier) {
      return await window.go.main.App.DeleteSupplier(supplierId);
    }
    const suppliers = getLocal('iluz_suppliers', []);
    const updated = suppliers.map((s) => (s.id === supplierId ? { ...s, active: false } : s));
    setLocal('iluz_suppliers', updated);
    return true;
  },

  // --- Locations & Shelves ---
  async getAllLocations() {
    if (isWails() && window.go.main.App.GetAllLocations) {
      return await window.go.main.App.GetAllLocations();
    }
    return getLocal('iluz_locations', [
      { id: 1, code: 'MOSTRADOR', name: 'Mostrador Principal', description: 'Cerca a la caja' },
    ]);
  },

  async saveLocation(loc) {
    if (isWails() && window.go.main.App.SaveLocation) {
      return await window.go.main.App.SaveLocation(loc);
    }
    const locs = getLocal('iluz_locations', []);
    const l = { ...loc };
    if (!l.id || l.id === 0) {
      l.id = Date.now();
      locs.push(l);
    } else {
      const idx = locs.findIndex((item) => item.id === l.id);
      if (idx >= 0) locs[idx] = l;
      else locs.push(l);
    }
    setLocal('iluz_locations', locs);
    return l;
  },

  async deleteLocation(id) {
    if (isWails() && window.go.main.App.DeleteLocation) {
      return await window.go.main.App.DeleteLocation(id);
    }
    const locs = getLocal('iluz_locations', []).filter((l) => l.id !== id);
    setLocal('iluz_locations', locs);
    return true;
  },

  async getAllShelves() {
    if (isWails() && window.go.main.App.GetAllShelves) {
      return await window.go.main.App.GetAllShelves();
    }
    return getLocal('iluz_shelves', [
      {
        id: 1,
        code: 'EST01',
        name: 'Estantería 1',
        description: 'Pasillo central',
        levels: [{ level: 1, name: 'Nivel 1', slots: 3 }],
      },
    ]);
  },

  async saveShelf(shelf) {
    if (isWails() && window.go.main.App.SaveShelf) {
      return await window.go.main.App.SaveShelf(shelf);
    }
    const shelves = getLocal('iluz_shelves', []);
    const sh = { ...shelf };
    if (!sh.id || sh.id === 0) {
      sh.id = Date.now();
      shelves.push(sh);
    } else {
      const idx = shelves.findIndex((item) => item.id === sh.id);
      if (idx >= 0) shelves[idx] = sh;
      else shelves.push(sh);
    }
    setLocal('iluz_shelves', shelves);
    return sh;
  },

  async deleteShelf(id) {
    if (isWails() && window.go.main.App.DeleteShelf) {
      return await window.go.main.App.DeleteShelf(id);
    }
    const shelves = getLocal('iluz_shelves', []).filter((s) => s.id !== id);
    setLocal('iluz_shelves', shelves);
    return true;
  },

  // --- Sales & POS ---
  async completeSale(saleData) {
    if (isWails() && window.go.main.App.CompleteSale) {
      return await window.go.main.App.CompleteSale(saleData);
    }
    const sales = getLocal('iluz_sales', []);
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ticketNumber = `REM-${todayStr}-${String(sales.length + 1).padStart(4, '0')}`;
    const completed = {
      ...saleData,
      id: Date.now(),
      ticketNumber,
      createdAt: new Date().toISOString(),
      deviceId: 'SUNMI_POS',
    };
    sales.push(completed);
    setLocal('iluz_sales', sales);

    // Descontar inventario local
    const prods = getLocal('iluz_products', []);
    if (saleData.items && Array.isArray(saleData.items)) {
      saleData.items.forEach((item) => {
        const p = prods.find((prod) => prod.barcode === item.barcode || prod.id === item.productId);
        if (p) p.stock = (p.stock || 0) - (item.qty || 1);
      });
      setLocal('iluz_products', prods);
    }

    // Actualizar efectivo esperado en turno si fue en efectivo
    if (saleData.paymentMethod === 'cash') {
      const shift = getLocal('iluz_current_shift', null);
      if (shift && shift.status === 'open') {
        shift.expectedCash = (shift.expectedCash || 0) + (saleData.totalAmount || 0);
        setLocal('iluz_current_shift', shift);
      }
    }

    // Intentar sincronizar en segundo plano si está conectado a la red
    syncService.syncSales([completed]).catch(() => {});
    return completed;
  },

  // --- Cash Shifts ---
  async openCashShift(initialCash, notes = '') {
    if (isWails() && window.go.main.App.OpenCashShift) {
      return await window.go.main.App.OpenCashShift(parseFloat(initialCash) || 0, notes);
    }
    const shift = {
      id: Date.now(),
      openedAt: new Date().toISOString(),
      closedAt: null,
      initialCash: parseFloat(initialCash) || 0,
      expectedCash: parseFloat(initialCash) || 0,
      actualCash: null,
      status: 'open',
      notes,
      deviceId: 'SUNMI_POS',
    };
    setLocal('iluz_current_shift', shift);
    return shift;
  },

  async getCurrentCashShift() {
    if (isWails() && window.go.main.App.GetCurrentCashShift) {
      return await window.go.main.App.GetCurrentCashShift();
    }
    return getLocal('iluz_current_shift', null);
  },

  async closeCashShift(shiftId, actualCash, assimilateDifference = false, notes = '') {
    if (isWails() && window.go.main.App.CloseCashShift) {
      return await window.go.main.App.CloseCashShift(shiftId, parseFloat(actualCash) || 0, assimilateDifference, notes);
    }
    const shift = getLocal('iluz_current_shift', null);
    if (shift) {
      shift.closedAt = new Date().toISOString();
      shift.actualCash = parseFloat(actualCash) || 0;
      shift.status = 'closed';
      shift.notes = notes;
      setLocal('iluz_current_shift', null);
      return shift;
    }
    return null;
  },

  // --- Purchases ---
  async createPurchase(purchaseData) {
    if (isWails() && window.go.main.App.CreatePurchase) {
      return await window.go.main.App.CreatePurchase(purchaseData);
    }
    const purchases = getLocal('iluz_purchases', []);
    const purchase = {
      ...purchaseData,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: 'completed',
    };
    purchases.push(purchase);
    setLocal('iluz_purchases', purchases);

    // Incrementar stock local
    const prods = getLocal('iluz_products', []);
    if (purchaseData.items && Array.isArray(purchaseData.items)) {
      purchaseData.items.forEach((item) => {
        const p = prods.find((prod) => prod.barcode === item.barcode || prod.id === item.productId);
        if (p) {
          p.stock = (p.stock || 0) + (item.qty || 0);
          if (item.unitCost > 0) p.costPrice = item.unitCost;
          if (item.suggestedPrice > 0) p.price = item.suggestedPrice;
        }
      });
      setLocal('iluz_products', prods);
    }
    return purchase;
  },

  async listPurchases(limit = 50) {
    if (isWails() && window.go.main.App.ListPurchases) {
      return await window.go.main.App.ListPurchases(limit);
    }
    const purchases = getLocal('iluz_purchases', []);
    return purchases.slice(0, limit);
  },

  // --- Store Config ---
  async getStoreConfig() {
    if (isWails() && window.go.main.App.GetStoreConfig) {
      return await window.go.main.App.GetStoreConfig();
    }
    return getLocal('iluz_store_config', {
      storeName: 'Mi Tienda POS',
      ownerName: 'Administrador',
      nitOrCedula: '',
      address: '',
      phone: '',
      receiptFooter: '¡Gracias por su compra!',
      allowNegativeStock: true,
    });
  },

  async saveStoreConfig(cfg) {
    if (isWails() && window.go.main.App.SaveStoreConfig) {
      return await window.go.main.App.SaveStoreConfig(cfg);
    }
    setLocal('iluz_store_config', cfg);
    return cfg;
  },

  // --- Reports ---
  async getFinancialReports(period = 'month') {
    if (isWails() && window.go.main.App.GetFinancialReports) {
      return await window.go.main.App.GetFinancialReports(period);
    }
    const sales = getLocal('iluz_sales', []);
    const purchases = getLocal('iluz_purchases', []);
    const totalSales = sales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const totalPurchases = purchases.reduce((acc, p) => acc + (p.totalCost || 0), 0);
    const grossMargin = totalSales - totalPurchases;
    const grossMarginPct = totalSales > 0 ? (grossMargin / totalSales) * 100 : 0;
    const averageTicket = sales.length > 0 ? totalSales / sales.length : 0;
    const uvtThreshold = 174296500;
    const dianCurrentPct = (totalSales / uvtThreshold) * 100;

    return {
      period,
      totalSales,
      totalPurchases,
      grossMargin,
      grossMarginPct,
      salesCount: sales.length,
      purchasesCount: purchases.length,
      averageTicket,
      dianUvtThreshold: uvtThreshold,
      dianCurrentPct,
    };
  },

  async getSyncServerStatus() {
    if (isWails() && window.go.main.App.GetSyncServerStatus) {
      return await window.go.main.App.GetSyncServerStatus();
    }
    return syncService.getServerConfig();
  },
};

export default apiAdapter;
