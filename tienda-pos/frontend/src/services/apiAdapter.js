import syncService from './syncService';

const isWails = !!window.go?.main?.App;

const apiAdapter = {
  isWails,

  async searchBarcode(barcode) {
    if (isWails && window.go?.main?.App?.SearchBarcode) {
      return await window.go.main.App.SearchBarcode(barcode);
    } else {
      return await syncService.fetchLocal('/api/products/search', { barcode });
    }
  },

  async saveProduct(product) {
    if (isWails && window.go?.main?.App?.SaveProduct) {
      return await window.go.main.App.SaveProduct(product);
    } else {
      return await syncService.fetchLocal('/api/products/save', product, 'POST');
    }
  },

  async listProducts(page, limit, search) {
    if (isWails && window.go?.main?.App?.ListProducts) {
      return await window.go.main.App.ListProducts(page, limit, search);
    } else {
      return await syncService.fetchLocal('/api/products', { page, limit, search });
    }
  },

  async completeSale(saleData) {
    if (isWails && window.go?.main?.App?.CompleteSale) {
      return await window.go.main.App.CompleteSale(saleData);
    } else {
      return await syncService.fetchLocal('/api/sales/complete', saleData, 'POST');
    }
  },

  async openCashShift(initialCash) {
    if (isWails && window.go?.main?.App?.OpenCashShift) {
      return await window.go.main.App.OpenCashShift(initialCash);
    } else {
      return await syncService.fetchLocal('/api/cash/open', { initialCash }, 'POST');
    }
  },

  async getCurrentCashShift() {
    if (isWails && window.go?.main?.App?.GetCurrentCashShift) {
      return await window.go.main.App.GetCurrentCashShift();
    } else {
      return await syncService.fetchLocal('/api/cash/current');
    }
  },

  async closeCashShift(closingData) {
    if (isWails && window.go?.main?.App?.CloseCashShift) {
      return await window.go.main.App.CloseCashShift(closingData);
    } else {
      return await syncService.fetchLocal('/api/cash/close', closingData, 'POST');
    }
  },

  async listSuppliers() {
    if (isWails && window.go?.main?.App?.ListSuppliers) {
      return await window.go.main.App.ListSuppliers();
    } else {
      return await syncService.fetchLocal('/api/suppliers');
    }
  },

  async saveSupplier(supplier) {
    if (isWails && window.go?.main?.App?.SaveSupplier) {
      return await window.go.main.App.SaveSupplier(supplier);
    } else {
      return await syncService.fetchLocal('/api/suppliers/save', supplier, 'POST');
    }
  },

  async createPurchase(purchaseData) {
    if (isWails && window.go?.main?.App?.CreatePurchase) {
      return await window.go.main.App.CreatePurchase(purchaseData);
    } else {
      return await syncService.fetchLocal('/api/purchases/create', purchaseData, 'POST');
    }
  },

  async getFinancialReports(filter) {
    if (isWails && window.go?.main?.App?.GetFinancialReports) {
      return await window.go.main.App.GetFinancialReports(filter);
    } else {
      return await syncService.fetchLocal('/api/reports/financial', filter);
    }
  },

  async getSyncServerStatus() {
    if (isWails && window.go?.main?.App?.GetSyncServerStatus) {
      return await window.go.main.App.GetSyncServerStatus();
    } else {
      return syncService.getServerConfig();
    }
  }
};

export default apiAdapter;
