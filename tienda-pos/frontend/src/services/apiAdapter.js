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
    if (isWails() && window.go?.main?.App?.UpdateProductLocation) {
      return await window.go.main.App.UpdateProductLocation(barcode, newLocation);
    }
    const products = getLocal('iluz_products', []);
    const updated = products.map((p) => (p.barcode === barcode ? { ...p, location: newLocation } : p));
    setLocal('iluz_products', updated);
    return true;
  },

  async importCatalogCSV(csvContent) {
    if (isWails() && window.go?.main?.App?.ImportCatalogCSV) {
      return await window.go.main.App.ImportCatalogCSV(csvContent);
    }
    return this._parseAndImportCSVLocal(csvContent);
  },

  async linkBarcodeToProduct(productId, barcode) {
    if (isWails() && window.go?.main?.App?.LinkBarcodeToProduct) {
      return await window.go.main.App.LinkBarcodeToProduct(productId, barcode);
    }
    const cleanBarcode = (barcode || '').trim();
    if (!cleanBarcode) throw new Error('El código de barras no puede estar vacío');
    if (!productId || productId <= 0) throw new Error('ID de producto inválido');

    const products = getLocal('iluz_products', []);
    const existing = products.find((p) => p.barcode === cleanBarcode && p.id !== productId);
    if (existing) {
      throw new Error(`El código de barras '${cleanBarcode}' ya está asignado al producto '${existing.name}'`);
    }

    const idx = products.findIndex((p) => p.id === productId);
    if (idx === -1) {
      throw new Error(`Producto con ID ${productId} no encontrado`);
    }

    products[idx] = {
      ...products[idx],
      barcode: cleanBarcode,
    };
    setLocal('iluz_products', products);
    return true;
  },

  _parseAndImportCSVLocal(csvContent) {
    let clean = (csvContent || '').replace(/^\uFEFF/, '').trim();
    if (!clean) throw new Error('El contenido CSV está vacío');

    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error('El archivo CSV no contiene registros de datos');

    const firstLine = lines[0];
    const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

    const parseLine = (line) => {
      const res = [];
      let inQuote = false;
      let cur = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuote && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuote = !inQuote;
          }
        } else if (c === delimiter && !inQuote) {
          res.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      res.push(cur.trim());
      return res;
    };

    const header = parseLine(lines[0]).map((h) => h.toUpperCase().replace(/^\uFEFF/, '').trim());
    const findCol = (...names) => {
      for (const n of names) {
        const idx = header.indexOf(n);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const nameIdx = findCol('ARTICULO', 'PRODUCTO', 'NOMBRE', 'NAME', 'DESCRIPCION');
    const catIdx = findCol('CATEGORIA', 'CATEGORY', 'DEPARTAMENTO');
    const costIdx = findCol('PRECIO_COSTO_COP', 'PRECIO_COSTO', 'COSTO', 'COST_PRICE');
    const priceIdx = findCol('PRECIO_VENTA_SUGERIDO_COP', 'PRECIO_VENTA', 'PRECIO', 'PRICE', 'SUGGESTED_PRICE');
    const stockIdx = findCol('CANTIDAD_STOCK', 'STOCK', 'CANTIDAD', 'QTY');
    const shelfIdx = findCol('ESTANTE_ORIGINAL', 'ESTANTE', 'UBICACION', 'LOCACION', 'LOCATION');
    const barcodeIdx = findCol('BARCODE', 'CODIGO', 'CODIGO_BARRAS', 'EAN');

    if (nameIdx === -1) throw new Error("Columna requerida 'ARTICULO' o 'NOMBRE' no encontrada en el CSV");

    const cleanNum = (val) => {
      if (!val) return 0;
      let s = String(val).replace(/\$/g, '').replace(/\s/g, '');
      if (s.toUpperCase().includes('PENDIENTE')) return 0;
      if (s.includes(',') && !s.includes('.')) {
        const parts = s.split(',');
        if (parts.length === 2 && parts[1].length === 3) s = s.replace(/,/g, '');
        else if (parts.length > 2) s = s.replace(/,/g, '');
        else s = s.replace(/,/g, '.');
      } else if (s.includes('.') && s.includes(',')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
          s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
          s = parts.join('');
        }
      }
      const num = parseFloat(s);
      return isNaN(num) ? 0 : num;
    };

    const isBulk = (name, cat) => {
      const u = (name || '').toUpperCase();
      const cu = (cat || '').toUpperCase();
      if (
        u.includes('HUEVO') ||
        u.startsWith('PAN ') ||
        u.includes('PAN ARTESANAL') ||
        u.includes('PAN ROLLO') ||
        u.includes('CARNE DE RES') ||
        u.includes('PECHUGA') ||
        u.includes('YUCA') ||
        u.includes('BOMBÓN') ||
        u.includes('BOMBON') ||
        u.includes('GOMITA') ||
        u.includes('BOLSA') ||
        u.includes('FÓSFORO') ||
        u.includes('FOSFORO')
      ) return true;
      if (cu.includes('CARNES') && (u.includes('LB') || u.includes('KILO'))) return true;
      return false;
    };

    const products = getLocal('iluz_products', []);
    let maxId = products.reduce((m, p) => Math.max(m, p.id || 0), 0);
    let nextSeq = maxId + 1;
    const existingBarcodes = new Set(products.map((p) => p.barcode));
    const genBarcode = () => {
      while (true) {
        const code = `ILUZ-${String(nextSeq).padStart(4, '0')}`;
        nextSeq++;
        if (!existingBarcodes.has(code)) {
          existingBarcodes.add(code);
          return code;
        }
      }
    };

    let inserted = 0;
    let updated = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (nameIdx >= row.length) continue;
      const rawName = (row[nameIdx] || '').trim();
      if (!rawName) continue;

      const normName = rawName.replace(/\s+/g, ' ').toUpperCase();
      const cat = catIdx !== -1 && catIdx < row.length ? row[catIdx].trim() : '';
      const cost = costIdx !== -1 && costIdx < row.length ? cleanNum(row[costIdx]) : 0;
      const price = priceIdx !== -1 && priceIdx < row.length ? cleanNum(row[priceIdx]) : 0;
      const stock = stockIdx !== -1 && stockIdx < row.length ? Math.round(cleanNum(row[stockIdx])) : 0;
      const shelf = shelfIdx !== -1 && shelfIdx < row.length ? row[shelfIdx].trim() : '';
      const customBc = barcodeIdx !== -1 && barcodeIdx < row.length ? row[barcodeIdx].trim() : '';
      const quickAccess = isBulk(rawName, cat);

      const existingIdx = products.findIndex(
        (p) => (p.name || '').replace(/\s+/g, ' ').toUpperCase() === normName
      );

      if (existingIdx !== -1) {
        const ex = products[existingIdx];
        products[existingIdx] = {
          ...ex,
          category: ex.category || cat,
          costPrice: ex.costPrice > 0 ? ex.costPrice : cost,
          price: ex.price > 0 ? ex.price : price,
          stock: ex.stock > 0 ? ex.stock : stock,
          location: ex.location || shelf,
          isQuickAccess: Boolean(ex.isQuickAccess || quickAccess),
        };
        updated++;
      } else {
        let bc = customBc && !existingBarcodes.has(customBc) ? customBc : genBarcode();
        maxId++;
        products.push({
          id: maxId,
          barcode: bc,
          name: rawName,
          category: cat,
          costPrice: cost,
          price: price,
          stock: stock,
          weight: 0,
          size: '',
          unitOfMeasure: 'und',
          color: '',
          location: shelf,
          active: true,
          isQuickAccess: quickAccess,
        });
        inserted++;
      }
    }

    setLocal('iluz_products', products);
    return {
      totalProcessed: inserted + updated,
      inserted,
      updated,
      errors,
    };
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

  // --- Credit Accounts ---
  async listCreditAccounts() {
    if (isWails() && window.go.main.App.ListCreditAccounts) {
      return await window.go.main.App.ListCreditAccounts();
    }
    return getLocal('iluz_credit_accounts', []);
  },

  async recordCreditPayment(accountId, amount, notes = '') {
    if (isWails() && window.go.main.App.RecordCreditPayment) {
      return await window.go.main.App.RecordCreditPayment(accountId, parseFloat(amount) || 0, notes);
    }
    const accounts = getLocal('iluz_credit_accounts', []);
    const acc = accounts.find((a) => a.id === accountId);
    if (acc) {
      acc.currentDebt = Math.max(0, (acc.currentDebt || 0) - (parseFloat(amount) || 0));
      setLocal('iluz_credit_accounts', accounts);
    }
    return true;
  },

  // --- Inventory CSV ---
  async exportInventoryCSV() {
    if (isWails() && window.go.main.App.ExportInventoryCSV) {
      return await window.go.main.App.ExportInventoryCSV();
    }
    const prods = getLocal('iluz_products', []);
    let csv = 'Código,Nombre,Categoría,Precio,Costo,Stock,Ubicación,Estado\n';
    prods.forEach((p) => {
      csv += `"${p.barcode || ''}","${p.name || ''}","${p.category || ''}",${p.price || 0},${p.costPrice || 0},${p.stock || 0},"${p.location || ''}","${p.active !== false ? 'Activo' : 'Inactivo'}"\n`;
    });
    return csv;
  },

  async exportInventoryCSVFile() {
    if (isWails() && window.go.main.App.ExportInventoryCSVFile) {
      return await window.go.main.App.ExportInventoryCSVFile();
    }
    return null;
  },

  // --- Inventory Audits (Physical Stock Take) ---
  async startInventorySession(name, responsible, scope = 'ALL', notes = '') {
    if (isWails() && window.go.main.App.StartInventorySession) {
      return await window.go.main.App.StartInventorySession(name, responsible, scope, notes);
    }
    const sess = {
      id: Date.now(),
      name,
      responsible,
      scope,
      notes,
      status: 'active',
      startedAt: new Date().toISOString(),
      closedAt: null,
    };
    const sessions = getLocal('iluz_audit_sessions', []);
    sessions.push(sess);
    setLocal('iluz_audit_sessions', sessions);
    setLocal('iluz_active_audit_session', sess);

    // Populate initial items from active catalog
    const prods = getLocal('iluz_products', []);
    const items = prods.filter((p) => p.active !== false).map((p, idx) => ({
      id: sess.id + idx + 1,
      sessionId: sess.id,
      productId: p.id,
      barcode: p.barcode,
      productName: p.name,
      category: p.category || '',
      systemStock: p.stock || 0,
      countedStock: 0,
      discrepancy: 0 - (p.stock || 0),
      locationBreakdown: {},
      lastCountedAt: null,
    }));
    setLocal(`iluz_audit_items_${sess.id}`, items);
    return sess;
  },

  async getActiveInventorySession() {
    if (isWails() && window.go.main.App.GetActiveInventorySession) {
      return await window.go.main.App.GetActiveInventorySession();
    }
    return getLocal('iluz_active_audit_session', null);
  },

  async listInventorySessionItems(sessionId) {
    if (isWails() && window.go.main.App.ListInventorySessionItems) {
      return await window.go.main.App.ListInventorySessionItems(sessionId);
    }
    return getLocal(`iluz_audit_items_${sessionId}`, []);
  },

  async recordInventoryScan(sessionId, barcode, locationCode) {
    if (isWails() && window.go.main.App.RecordInventoryScan) {
      return await window.go.main.App.RecordInventoryScan(sessionId, barcode, locationCode);
    }
    const items = getLocal(`iluz_audit_items_${sessionId}`, []);
    let item = items.find((i) => i.barcode === barcode);
    if (!item) {
      // Check if product exists in catalog
      const prods = getLocal('iluz_products', []);
      const p = prods.find((prod) => prod.barcode === barcode);
      if (!p) {
        throw new Error(`UNKNOWN_BARCODE:${barcode}`);
      }
      item = {
        id: Date.now(),
        sessionId,
        productId: p.id,
        barcode: p.barcode,
        productName: p.name,
        category: p.category || '',
        systemStock: p.stock || 0,
        countedStock: 1,
        discrepancy: 1 - (p.stock || 0),
        locationBreakdown: { [locationCode || 'TIENDA']: 1 },
        lastCountedAt: new Date().toISOString(),
      };
      items.push(item);
    } else {
      item.countedStock = (item.countedStock || 0) + 1;
      item.discrepancy = item.countedStock - item.systemStock;
      const loc = locationCode || 'TIENDA';
      item.locationBreakdown = item.locationBreakdown || {};
      item.locationBreakdown[loc] = (item.locationBreakdown[loc] || 0) + 1;
      item.lastCountedAt = new Date().toISOString();
    }
    setLocal(`iluz_audit_items_${sessionId}`, items);
    return item;
  },

  async recordBatchCount(sessionItemId, locationCode, qty, replace = false) {
    if (isWails() && window.go.main.App.RecordBatchCount) {
      return await window.go.main.App.RecordBatchCount(sessionItemId, locationCode, qty, replace);
    }
    const sess = getLocal('iluz_active_audit_session', null);
    if (!sess) return false;
    const items = getLocal(`iluz_audit_items_${sess.id}`, []);
    const item = items.find((i) => i.id === sessionItemId);
    if (item) {
      const addedQty = parseInt(qty, 10) || 0;
      if (replace) {
        item.countedStock = addedQty;
      } else {
        item.countedStock = (item.countedStock || 0) + addedQty;
      }
      item.discrepancy = item.countedStock - item.systemStock;
      const loc = locationCode || 'TIENDA';
      item.locationBreakdown = item.locationBreakdown || {};
      item.locationBreakdown[loc] = (item.locationBreakdown[loc] || 0) + addedQty;
      item.lastCountedAt = new Date().toISOString();
      setLocal(`iluz_audit_items_${sess.id}`, items);
    }
    return true;
  },

  async undoLastCount(sessionItemId) {
    if (isWails() && window.go.main.App.UndoLastCount) {
      return await window.go.main.App.UndoLastCount(sessionItemId);
    }
    const sess = getLocal('iluz_active_audit_session', null);
    if (!sess) return false;
    const items = getLocal(`iluz_audit_items_${sess.id}`, []);
    const item = items.find((i) => i.id === sessionItemId);
    if (item && item.countedStock > 0) {
      item.countedStock -= 1;
      item.discrepancy = item.countedStock - item.systemStock;
      setLocal(`iluz_audit_items_${sess.id}`, items);
    }
    return true;
  },

  async closeInventorySession(sessionId, productIdsToUpdate = []) {
    if (isWails() && window.go.main.App.CloseInventorySession) {
      return await window.go.main.App.CloseInventorySession(sessionId, productIdsToUpdate);
    }
    const sessions = getLocal('iluz_audit_sessions', []);
    const sess = sessions.find((s) => s.id === sessionId);
    if (sess) {
      sess.status = 'closed';
      sess.closedAt = new Date().toISOString();
      setLocal('iluz_audit_sessions', sessions);
    }
    setLocal('iluz_active_audit_session', null);

    // Update product stock for selected products
    const items = getLocal(`iluz_audit_items_${sessionId}`, []);
    const prods = getLocal('iluz_products', []);
    items.forEach((item) => {
      if (productIdsToUpdate.length === 0 || productIdsToUpdate.includes(item.productId)) {
        const p = prods.find((prod) => prod.id === item.productId);
        if (p) p.stock = item.countedStock;
      }
    });
    setLocal('iluz_products', prods);

    const completed = getLocal('iluz_completed_audit_sessions', []);
    if (sess) completed.unshift(sess);
    setLocal('iluz_completed_audit_sessions', completed);
    return true;
  },

  async cancelInventorySession(sessionId) {
    if (isWails() && window.go.main.App.CancelInventorySession) {
      return await window.go.main.App.CancelInventorySession(sessionId);
    }
    const sessions = getLocal('iluz_audit_sessions', []).filter((s) => s.id !== sessionId);
    setLocal('iluz_audit_sessions', sessions);
    setLocal('iluz_active_audit_session', null);
    return true;
  },

  async listCompletedInventorySessions() {
    if (isWails() && window.go.main.App.ListCompletedInventorySessions) {
      return await window.go.main.App.ListCompletedInventorySessions();
    }
    return getLocal('iluz_completed_audit_sessions', []);
  },

  async exportInventorySessionCSV(sessionId) {
    if (isWails() && window.go.main.App.ExportInventorySessionCSV) {
      return await window.go.main.App.ExportInventorySessionCSV(sessionId);
    }
    const items = getLocal(`iluz_audit_items_${sessionId}`, []);
    let csv = 'Código,Producto,Categoría,Stock Sistema,Conteo Físico,Diferencia\n';
    items.forEach((i) => {
      csv += `"${i.barcode || ''}","${i.productName || ''}","${i.category || ''}",${i.systemStock || 0},${i.countedStock || 0},${i.discrepancy || 0}\n`;
    });
    return csv;
  },

  async exportInventorySessionCSVFile(sessionId) {
    if (isWails() && window.go.main.App.ExportInventorySessionCSVFile) {
      return await window.go.main.App.ExportInventorySessionCSVFile(sessionId);
    }
    return null;
  },

  // --- Hardware / COM Ports ---
  async getAvailablePorts() {
    if (isWails() && window.go.main.App.GetAvailablePorts) {
      return await window.go.main.App.GetAvailablePorts();
    }
    return [];
  },

  async getCurrentPort() {
    if (isWails() && window.go.main.App.GetCurrentPort) {
      return await window.go.main.App.GetCurrentPort();
    }
    return '';
  },

  async setScannerPort(portName) {
    if (isWails() && window.go.main.App.SetScannerPort) {
      return await window.go.main.App.SetScannerPort(portName);
    }
    return null;
  },

  async processBarcode(barcode) {
    if (isWails() && window.go.main.App.ProcessBarcode) {
      return await window.go.main.App.ProcessBarcode(barcode);
    }
    const product = await this.searchBarcode(barcode);
    return {
      barcode,
      found: Boolean(product),
      product,
      timestamp: new Date().toISOString(),
    };
  },
};

export default apiAdapter;
