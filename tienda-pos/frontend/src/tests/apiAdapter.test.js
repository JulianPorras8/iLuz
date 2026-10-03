import { describe, it, expect, beforeEach } from 'vitest';
import apiAdapter from '../services/apiAdapter';

describe('apiAdapter - Android / Non-Wails (Local-First Offline) Mode', () => {
  beforeEach(() => {
    // Ensure window.go is undefined (simulating Android / Capacitor / Web browser)
    delete window.go;
    localStorage.clear();
  });

  describe('Suppliers CRUD', () => {
    it('creates a new supplier with auto-generated id and timestamps without crashing', async () => {
      const newSup = {
        name: 'Distribuidora Central S.A.S.',
        nitOrCedula: '900.555.123-1',
        contactName: 'Andrés Pérez',
        phone: '3001234567',
        paymentTerms: 'Crédito 15 días',
        active: true,
      };

      const saved = await apiAdapter.saveSupplier(newSup);

      expect(saved).toBeDefined();
      expect(saved.id).toBeGreaterThan(0);
      expect(saved.name).toBe('Distribuidora Central S.A.S.');
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();

      // Verify persistence in localStorage
      const stored = JSON.parse(localStorage.getItem('iluz_suppliers'));
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(saved.id);
    });

    it('lists suppliers with active filtering', async () => {
      await apiAdapter.saveSupplier({ name: 'Proveedor Activo', active: true });
      const inactive = await apiAdapter.saveSupplier({ name: 'Proveedor Inactivo', active: false });

      const all = await apiAdapter.listSuppliers(false);
      expect(all).toHaveLength(2);

      const activeOnly = await apiAdapter.listSuppliers(true);
      expect(activeOnly).toHaveLength(1);
      expect(activeOnly[0].name).toBe('Proveedor Activo');
    });

    it('updates an existing supplier', async () => {
      const created = await apiAdapter.saveSupplier({ name: 'Proveedor Inicial', phone: '111', active: true });
      const updated = await apiAdapter.saveSupplier({ ...created, name: 'Proveedor Modificado', phone: '222' });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Proveedor Modificado');
      expect(updated.phone).toBe('222');

      const list = await apiAdapter.listSuppliers(false);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Proveedor Modificado');
    });

    it('deactivates (deletes) a supplier', async () => {
      const created = await apiAdapter.saveSupplier({ name: 'A Eliminar', active: true });
      await apiAdapter.deleteSupplier(created.id);

      const activeList = await apiAdapter.listSuppliers(true);
      expect(activeList).toHaveLength(0);

      const allList = await apiAdapter.listSuppliers(false);
      expect(allList).toHaveLength(1);
      expect(allList[0].active).toBe(false);
    });
  });

  describe('Products CRUD', () => {
    it('creates a product without barcode and generates INT-XXXXXX internal code', async () => {
      const prod = {
        name: 'Pan Casero',
        price: 800,
        costPrice: 500,
        stock: 30,
        active: true,
      };

      const saved = await apiAdapter.saveProduct(prod);
      expect(saved.id).toBeGreaterThan(0);
      expect(saved.barcode).toMatch(/^INT-\d+/);

      const found = await apiAdapter.searchBarcode(saved.barcode);
      expect(found).not.toBeNull();
      expect(found.name).toBe('Pan Casero');
    });

    it('archives and restores a product', async () => {
      const saved = await apiAdapter.saveProduct({ barcode: '770111222', name: 'Leche', active: true });

      await apiAdapter.archiveProduct('770111222');
      let found = await apiAdapter.searchBarcode('770111222');
      expect(found).toBeNull(); // searchBarcode only returns active products

      await apiAdapter.restoreProduct('770111222');
      found = await apiAdapter.searchBarcode('770111222');
      expect(found).not.toBeNull();
      expect(found.active).toBe(true);
    });

    it('updates product location', async () => {
      await apiAdapter.saveProduct({ barcode: '770333', name: 'Arroz', location: 'EST01-N1' });
      await apiAdapter.updateProductLocation('770333', 'EST02-N3');

      const found = await apiAdapter.searchBarcode('770333');
      expect(found.location).toBe('EST02-N3');
    });
  });

  describe('Locations & Shelves CRUD', () => {
    it('manages locations', async () => {
      const loc = await apiAdapter.saveLocation({ code: 'PASILLO1', name: 'Pasillo 1' });
      expect(loc.id).toBeDefined();

      const locs = await apiAdapter.getAllLocations();
      expect(locs.some((l) => l.code === 'PASILLO1')).toBe(true);

      await apiAdapter.deleteLocation(loc.id);
      const afterDel = await apiAdapter.getAllLocations();
      expect(afterDel.some((l) => l.code === 'PASILLO1')).toBe(false);
    });

    it('manages shelves', async () => {
      const shelf = await apiAdapter.saveShelf({ code: 'NEV01', name: 'Nevera Lácteos', levels: [] });
      expect(shelf.id).toBeDefined();

      const shelves = await apiAdapter.getAllShelves();
      expect(shelves.some((s) => s.code === 'NEV01')).toBe(true);

      await apiAdapter.deleteShelf(shelf.id);
      const afterDel = await apiAdapter.getAllShelves();
      expect(afterDel.some((s) => s.code === 'NEV01')).toBe(false);
    });
  });

  describe('Cash Shifts & Sales Flow', () => {
    it('opens shift, records cash sale, increments expected cash, and closes shift', async () => {
      // 1. Open shift with $50.000 base
      const shift = await apiAdapter.openCashShift(50000, 'Inicio de jornada');
      expect(shift.status).toBe('open');
      expect(shift.initialCash).toBe(50000);
      expect(shift.expectedCash).toBe(50000);

      // 2. Setup a product with stock 10
      const prod = await apiAdapter.saveProduct({ barcode: '770999', name: 'Aceite', price: 10000, stock: 10 });

      // 3. Complete a cash sale for $20.000 (2 units)
      const sale = await apiAdapter.completeSale({
        totalAmount: 20000,
        paymentMethod: 'cash',
        amountPaid: 20000,
        changeDue: 0,
        items: [{ productId: prod.id, barcode: prod.barcode, qty: 2, unitPrice: 10000, subtotal: 20000 }],
      });
      expect(sale.ticketNumber).toMatch(/^REM-\d+-\d+/);
      expect(sale.deviceId).toBe('SUNMI_POS');

      // 4. Verify stock decremented: 10 - 2 = 8
      const prodAfter = await apiAdapter.searchBarcode('770999');
      expect(prodAfter.stock).toBe(8);

      // 5. Verify shift expectedCash incremented: 50.000 + 20.000 = 70.000
      const currentShift = await apiAdapter.getCurrentCashShift();
      expect(currentShift.expectedCash).toBe(70000);

      // 6. Close shift with actualCash 70.000
      const closed = await apiAdapter.closeCashShift(currentShift.id, 70000, false, 'Cierre sin descuadre');
      expect(closed.status).toBe('closed');
      expect(closed.actualCash).toBe(70000);

      const activeAfterClose = await apiAdapter.getCurrentCashShift();
      expect(activeAfterClose).toBeNull();
    });
  });

  describe('Purchases Intake Flow', () => {
    it('creates purchase, increments stock, and updates cost price', async () => {
      const prod = await apiAdapter.saveProduct({ barcode: '770888', name: 'Atún', price: 5000, costPrice: 3500, stock: 5 });

      await apiAdapter.createPurchase({
        supplierId: 1,
        invoiceNumber: 'FAC-1024',
        totalCost: 40000,
        items: [
          {
            productId: prod.id,
            barcode: prod.barcode,
            qty: 10,
            unitCost: 4000, // Cost increased from 3500 to 4000
            suggestedPrice: 5800,
          },
        ],
      });

      const updatedProd = await apiAdapter.searchBarcode('770888');
      expect(updatedProd.stock).toBe(15); // 5 + 10 = 15
      expect(updatedProd.costPrice).toBe(4000);
      expect(updatedProd.price).toBe(5800);
    });
  });

  describe('Store Config', () => {
    it('saves and reads store configuration', async () => {
      const cfg = {
        storeName: 'Supermercado Los Porras',
        ownerName: 'Don Julián',
        nitOrCedula: '123456789',
        address: 'Carrera 10 # 20-30',
        phone: '3159998877',
        receiptFooter: 'Dios le bendiga',
        allowNegativeStock: false,
      };

      await apiAdapter.saveStoreConfig(cfg);
      const read = await apiAdapter.getStoreConfig();
      expect(read.storeName).toBe('Supermercado Los Porras');
      expect(read.allowNegativeStock).toBe(false);
    });
  });
});

describe('apiAdapter - Wails Desktop Mode (Delegation Verification)', () => {
  beforeEach(() => {
    window.go = {
      main: {
        App: {
          SaveSupplier: async (s) => ({ ...s, id: 999, wails: true }),
          ListSuppliers: async () => [{ id: 999, name: 'From Wails DB' }],
          DeleteSupplier: async (id) => true,
          SaveProduct: async (p) => ({ ...p, id: 888, wails: true }),
          ListInventoryProducts: async () => [{ id: 888, name: 'From Wails DB' }],
          SearchBarcode: async (barcode) => ({ barcode, name: 'Wails Product' }),
          OpenCashShift: async (init, notes) => ({ id: 777, initialCash: init, wails: true }),
          GetCurrentCashShift: async () => ({ id: 777, status: 'open' }),
          CloseCashShift: async (id, actual, sim, notes) => ({ id, status: 'closed' }),
          CreatePurchase: async (data) => ({ ...data, id: 666, wails: true }),
          GetStoreConfig: async () => ({ storeName: 'Wails Config' }),
          SaveStoreConfig: async (cfg) => cfg,
        },
      },
    };
  });

  it('delegates saveSupplier to window.go.main.App.SaveSupplier when Wails is present', async () => {
    const res = await apiAdapter.saveSupplier({ name: 'Test Wails' });
    expect(res.id).toBe(999);
    expect(res.wails).toBe(true);
  });

  it('delegates listSuppliers to window.go.main.App.ListSuppliers', async () => {
    const list = await apiAdapter.listSuppliers();
    expect(list[0].name).toBe('From Wails DB');
  });

  it('delegates searchBarcode to window.go.main.App.SearchBarcode', async () => {
    const res = await apiAdapter.searchBarcode('123456');
    expect(res.name).toBe('Wails Product');
  });
});
