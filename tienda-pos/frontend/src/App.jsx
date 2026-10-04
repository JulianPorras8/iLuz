import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import apiAdapter from './services/apiAdapter';
import syncService from './services/syncService';
import sunmiHardware from './services/sunmiHardware';
import Header from './components/Header.jsx';
import POSView from './components/POSView.jsx';
import PositioningView from './components/PositioningView.jsx';
import InventoryView from './components/InventoryView.jsx';
import LocationsView from './components/LocationsView.jsx';
import StockAuditView from './components/StockAuditView.jsx';
import ProductModal from './components/ProductModal.jsx';
import LocationModal from './components/LocationModal.jsx';
import ShelfModal from './components/ShelfModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import StartAuditModal from './components/StartAuditModal.jsx';
import AuditReconciliationModal from './components/AuditReconciliationModal.jsx';
import CheckoutModal from './components/CheckoutModal.jsx';
import ReceiptModal from './components/ReceiptModal.jsx';
import CashShiftModal from './components/CashShiftModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Toast from './components/Toast.jsx';
import SuppliersView from './components/SuppliersView.jsx';
import SupplierModal from './components/SupplierModal.jsx';
import PurchaseIntakeView from './components/PurchaseIntakeView.jsx';
import ReportsView from './components/ReportsView.jsx';
import HardwareModal from './components/HardwareModal.jsx';
import BarcodeLinkModal from './components/BarcodeLinkModal.jsx';

// Shared singleton AudioContext for responsive audio feedback without leaking contexts
let audioCtxSingleton = null;
function playSoundChime(success = true) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtxSingleton || audioCtxSingleton.state === 'closed') {
      audioCtxSingleton = new AudioContextClass();
    }
    if (audioCtxSingleton.state === 'suspended') {
      audioCtxSingleton.resume();
    }
    const osc = audioCtxSingleton.createOscillator();
    const gain = audioCtxSingleton.createGain();

    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtxSingleton.currentTime); // A5
      gain.gain.setValueAtTime(0.15, audioCtxSingleton.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxSingleton.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtxSingleton.destination);
      osc.start();
      osc.stop(audioCtxSingleton.currentTime + 0.08);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, audioCtxSingleton.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtxSingleton.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxSingleton.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtxSingleton.destination);
      osc.start();
      osc.stop(audioCtxSingleton.currentTime + 0.15);
    }
  } catch (e) {
    // silently ignore if audio blocked
  }
}

export default function App() {
  // Navigation
  const [currentTab, setCurrentTab] = useState('pos');

  // Scanner & Ports State
  const [scannerStatus, setScannerStatus] = useState(null);
  const [availablePorts, setAvailablePorts] = useState([]);
  const [currentPort, setCurrentPort] = useState('COM3');

  // Data State
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [cart, setCart] = useState([]);

  // Active Contexts
  const [lastScannedProduct, setLastScannedProduct] = useState(null);
  const [unregisteredBarcode, setUnregisteredBarcode] = useState(null);
  const [activePositioningProduct, setActivePositioningProduct] = useState(null);

  // Physical Inventory Audit State (Mode B)
  const [activeAuditSession, setActiveAuditSession] = useState(null);
  const [auditItems, setAuditItems] = useState([]);
  const [completedAuditSessions, setCompletedAuditSessions] = useState([]);
  const [auditLocationCode, setAuditLocationCode] = useState('EST-A1');
  const [isStartAuditModalOpen, setIsStartAuditModalOpen] = useState(false);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [lastTouchedAuditItemId, setLastTouchedAuditItemId] = useState(null);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  const [isShelfModalOpen, setIsShelfModalOpen] = useState(false);
  const [editingShelf, setEditingShelf] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isDanger: false,
  });

  // POS Checkout, Shifts & Settings
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCashShiftModalOpen, setIsCashShiftModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [storeConfig, setStoreConfig] = useState(null);
  const [lastCompletedSale, setLastCompletedSale] = useState(null);

  // Phase 3 Modules: Suppliers, Purchases, Reports, Hardware
  const [suppliers, setSuppliers] = useState([]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [activePurchase, setActivePurchase] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [currentReportPeriod, setCurrentReportPeriod] = useState('month');

  // Barcode Linking & Catalog Import
  const [isBarcodeLinkModalOpen, setIsBarcodeLinkModalOpen] = useState(false);
  const [pendingBarcodeToLink, setPendingBarcodeToLink] = useState('');

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // --- Initial Data Load ---
  const loadInitialData = useCallback(async () => {
    try {
      const isWailsApp = typeof window !== 'undefined' && !!window.go?.main?.App;

      const [status, ports, port, locs, shs, prods, activeSess, completedSess, shift, cfg, sups, rep] = await Promise.all([
        isWailsApp && window.go?.main?.App?.GetScannerStatus ? window.go.main.App.GetScannerStatus() : Promise.resolve(null),
        apiAdapter.getAvailablePorts(),
        apiAdapter.getCurrentPort(),
        apiAdapter.getAllLocations(),
        apiAdapter.getAllShelves(),
        apiAdapter.listProducts(true),
        apiAdapter.getActiveInventorySession(),
        apiAdapter.listCompletedInventorySessions(),
        apiAdapter.getCurrentCashShift(),
        apiAdapter.getStoreConfig(),
        apiAdapter.listSuppliers(false),
        apiAdapter.getFinancialReports('month'),
      ]);

      if (status) setScannerStatus(status);
      setAvailablePorts(ports || []);
      setCurrentPort(port || 'COM3');
      setLocations(locs || []);
      setShelves(shs || []);
      setProducts(prods || []);
      setActiveAuditSession(activeSess || null);
      setCompletedAuditSessions(completedSess || []);
      setCurrentShift(shift || null);
      setStoreConfig(cfg || null);
      setSuppliers(sups || []);
      if (rep) setReportData(rep);

      if (activeSess) {
        const items = await apiAdapter.listInventorySessionItems(activeSess.id);
        setAuditItems(items || []);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
      showToast('Error cargando datos de inicio', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    if (window.go?.main?.App) {
      loadInitialData();
      return;
    }

    let retries = 5;
    const interval = setInterval(() => {
      if (window.go?.main?.App) {
        clearInterval(interval);
        loadInitialData();
      } else if (retries <= 0) {
        clearInterval(interval);
        loadInitialData();
      }
      retries--;
    }, 100);

    return () => clearInterval(interval);
  }, [loadInitialData]);

  // --- Hardware & Event Listeners ---
  const handleIncomingScan = useCallback(
    (data) => {
      const barcode = data.barcode;
      const found = data.found;
      const product = data.product;

      if (currentTab === 'pos') {
        if (found && product) {
          playSoundChime(true);
          setUnregisteredBarcode(null);
          setLastScannedProduct(product);
          // Add to cart
          setCart((prev) => {
            const existing = prev.find((item) => item.barcode === product.barcode || item.id === product.id);
            if (existing) {
              return prev.map((item) =>
                item.barcode === product.barcode || item.id === product.id
                  ? { ...item, qty: (item.qty || 1) + 1 }
                  : item
              );
            }
            return [...prev, { ...product, qty: 1 }];
          });
        } else {
          playSoundChime(false);
          setUnregisteredBarcode(barcode);
          setLastScannedProduct(null);
          setPendingBarcodeToLink(barcode);
          setIsBarcodeLinkModalOpen(true);
        }
      } else if (currentTab === 'positioning') {
        if (found && product) {
          setActivePositioningProduct(product);
        } else {
          setActivePositioningProduct(null);
          showToast(`Código no registrado: ${barcode}`, 'warning');
        }
      } else if (currentTab === 'inventory') {
        if (found && product) {
          showToast(`✏️ Editando: ${product.name}`, 'info');
          setEditingProduct(product);
          setIsProductModalOpen(true);
        } else {
          playSoundChime(false);
          setPendingBarcodeToLink(barcode);
          setIsBarcodeLinkModalOpen(true);
        }
      } else if (currentTab === 'audit') {
        if (isReconciliationModalOpen) {
          showToast('⏸️ Finalización en progreso: escaneos en pausa', 'warning');
          return;
        }

        if (activeAuditSession) {
          (async () => {
            try {
              const updated = await apiAdapter.recordInventoryScan(
                activeAuditSession.id,
                barcode,
                auditLocationCode
              );
              if (updated) {
                playSoundChime(true);
                showToast(`+1 en ${auditLocationCode}: ${updated.productName}`, 'success');
                setLastTouchedAuditItemId(updated.id);
                const items = await apiAdapter.listInventorySessionItems(activeAuditSession.id);
                setAuditItems(items || []);
              }
            } catch (err) {
              playSoundChime(false);
              const errStr = String(err || '');
              if (errStr.includes('UNKNOWN_BARCODE:')) {
                const unknownCode = errStr.split('UNKNOWN_BARCODE:')[1] || barcode;
                showToast(`Código ${unknownCode} no registrado. Abriendo catálogo para crearlo...`, 'warning');
                setUnregisteredBarcode(unknownCode);
                setEditingProduct({ barcode: unknownCode, active: true });
                setIsProductModalOpen(true);
              } else {
                showToast(`Error al registrar conteo: ${errStr}`, 'error');
              }
            }
          })();
        } else {
          showToast('Inicia una toma de inventario para registrar conteos', 'info');
        }
      } else if (currentTab === 'purchases') {
        if (!activePurchase) {
          showToast('Inicia un ingreso de factura a la izquierda para comenzar a escanear', 'info');
          return;
        }
        if (found && product) {
          setActivePurchase((prev) => {
            if (!prev) return prev;
            const items = prev.items || [];
            const existingIdx = items.findIndex(
              (it) => it.barcode === product.barcode || it.productId === product.id
            );
            if (existingIdx >= 0) {
              const updated = [...items];
              updated[existingIdx] = {
                ...updated[existingIdx],
                qty: (updated[existingIdx].qty || 1) + 1,
              };
              return { ...prev, items: updated };
            }
            const newItem = {
              id: product.id,
              productId: product.id,
              barcode: product.barcode,
              name: product.name,
              unitCost: product.costPrice || 0,
              previousCost: product.costPrice || 0,
              suggestedPrice: product.price || 0,
              qty: 1,
            };
            return { ...prev, items: [newItem, ...items] };
          });
          playSoundChime(true);
          showToast(`+1 en factura: ${product.name}`, 'success');
        } else {
          playSoundChime(false);
          showToast(`Código ${barcode} no registrado. Abriendo catálogo para crearlo...`, 'warning');
          setUnregisteredBarcode(barcode);
          setEditingProduct({ barcode, active: true });
          setIsProductModalOpen(true);
        }
      }
    },
    [currentTab, activeAuditSession, auditLocationCode, isReconciliationModalOpen, activePurchase, showToast]
  );

  useEffect(() => {
    if (window.runtime?.EventsOn) {
      const unbindStatus = window.runtime.EventsOn('scanner:status', (status) => {
        setScannerStatus(status);
        if (status.availablePorts) setAvailablePorts(status.availablePorts);
        if (status.port) setCurrentPort(status.port);
      });

      const unbindScan = window.runtime.EventsOn('barcode:scanned', (data) => {
        handleIncomingScan(data);
      });

      const unbindAuditSession = window.runtime.EventsOn('inventory:session_changed', async (sess) => {
        setActiveAuditSession(sess || null);
        if (sess) {
          const items = await apiAdapter.listInventorySessionItems(sess.id);
          setAuditItems(items || []);
        } else {
          setAuditItems([]);
        }
        const completed = await apiAdapter.listCompletedInventorySessions();
        setCompletedAuditSessions(completed || []);
      });

      const unbindItemCounted = window.runtime.EventsOn('inventory:item_counted', async () => {
        if (activeAuditSession?.id) {
          const items = await apiAdapter.listInventorySessionItems(activeAuditSession.id);
          setAuditItems(items || []);
        }
      });

      return () => {
        if (typeof unbindStatus === 'function') unbindStatus();
        if (typeof unbindScan === 'function') unbindScan();
        if (typeof unbindAuditSession === 'function') unbindAuditSession();
        if (typeof unbindItemCounted === 'function') unbindItemCounted();
      };
    }
  }, [handleIncomingScan, activeAuditSession]);

  // --- Keyboard Wedge Scanner Fallback ---
  useEffect(() => {
    let keyBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in form inputs or modals
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const activeId = document.activeElement?.id;
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (isInput && activeId !== 'quick-barcode') {
        return;
      }
      if (isProductModalOpen || isLocationModalOpen || confirmDialog.isOpen || isSupplierModalOpen || isHardwareModalOpen || isCheckoutModalOpen) {
        return;
      }

      // Global Navigation Hotkeys F1 - F6
      if (e.key === 'F1') {
        e.preventDefault();
        setCurrentTab('pos');
        return;
      } else if (e.key === 'F2') {
        e.preventDefault();
        setCurrentTab('inventory');
        return;
      } else if (e.key === 'F3') {
        e.preventDefault();
        setCurrentTab('positioning');
        return;
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCurrentTab('purchases');
        return;
      } else if (e.key === 'F5') {
        e.preventDefault();
        setCurrentTab('suppliers');
        return;
      } else if (e.key === 'F6') {
        e.preventDefault();
        setCurrentTab('reports');
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      // Typical barcode scanner fires keystrokes < 60ms apart
      if (diff > 150) {
        keyBuffer = '';
      }

      if (e.key === 'Enter') {
        if (keyBuffer.length >= 3) {
          e.preventDefault();
          const scannedCode = keyBuffer;
          keyBuffer = '';
          (async () => {
            try {
              const res = await apiAdapter.processBarcode(scannedCode);
              if (!apiAdapter.isWails) {
                handleIncomingScan(res);
              }
            } catch (err) {
              console.error('Scan handling error:', err);
            }
          })();
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        keyBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProductModalOpen, isLocationModalOpen, confirmDialog.isOpen, isSupplierModalOpen, isHardwareModalOpen, isCheckoutModalOpen]);

  // --- Port Switching ---
  const handlePortChange = async (newPort) => {
    setCurrentPort(newPort);
    try {
      await apiAdapter.setScannerPort(newPort);
      showToast(`Cambiando puerto a ${newPort}...`, 'info');
    } catch (err) {
      console.error('Error changing port:', err);
      showToast(`Error conectando a ${newPort}`, 'error');
    }
  };

  const handleRefreshPorts = async () => {
    try {
      const [ports, cur] = await Promise.all([
        apiAdapter.getAvailablePorts(),
        apiAdapter.getCurrentPort(),
      ]);
      setAvailablePorts(ports || []);
      if (cur) setCurrentPort(cur);
      showToast('Puertos COM actualizados', 'info');
    } catch (err) {
      console.error('Error refreshing ports:', err);
    }
  };

  // --- Product Operations ---
  const handleSaveProduct = async (prodData) => {
    try {
      await apiAdapter.saveProduct(prodData);
      setIsProductModalOpen(false);
      setEditingProduct(null);
      showToast('✅ Producto guardado exitosamente', 'success');

      // Refresh products
      const updated = await apiAdapter.listProducts(true);
      setProducts(updated || []);

      // If registered from POS or Audit unregistered prompt
      if (unregisteredBarcode && prodData.barcode === unregisteredBarcode) {
        if (currentTab === 'pos') {
          const fresh = (updated || []).find((p) => p.barcode === prodData.barcode);
          if (fresh) {
            setCart((prev) => [...prev, { ...fresh, qty: 1 }]);
            setLastScannedProduct(fresh);
            setUnregisteredBarcode(null);
          }
        } else if (currentTab === 'audit' && activeAuditSession) {
          // Auto-enroll new product into active audit session with initial +1 count (Spec Rule 5)
          try {
            const updatedItem = await apiAdapter.recordInventoryScan(
              activeAuditSession.id,
              prodData.barcode,
              auditLocationCode
            );
            if (updatedItem) {
              playSoundChime(true);
              showToast(`✅ ${prodData.name} creado y contado (+1) en ${auditLocationCode}`, 'success');
              setLastTouchedAuditItemId(updatedItem.id);
            }
          } catch (scanErr) {
            console.error('Error auto-recording scan for new product in audit:', scanErr);
          }
          setUnregisteredBarcode(null);
        } else if (currentTab === 'purchases' && activePurchase) {
          const fresh = (updated || []).find((p) => p.barcode === prodData.barcode);
          if (fresh) {
            setActivePurchase((prev) => {
              if (!prev) return prev;
              const items = prev.items || [];
              const newItem = {
                id: fresh.id,
                productId: fresh.id,
                barcode: fresh.barcode,
                name: fresh.name,
                unitCost: fresh.costPrice || 0,
                previousCost: fresh.costPrice || 0,
                suggestedPrice: fresh.price || 0,
                qty: 1,
              };
              return { ...prev, items: [newItem, ...items] };
            });
            playSoundChime(true);
            showToast(`✅ ${fresh.name} creado y agregado a la factura (+1)`, 'success');
            setUnregisteredBarcode(null);
          }
        }
      }

      // Refresh audit items if session active
      if (activeAuditSession) {
        const freshAuditItems = await apiAdapter.listInventorySessionItems(activeAuditSession.id);
        setAuditItems(freshAuditItems || []);
      }
    } catch (err) {
      console.error('Error saving product:', err);
      showToast('❌ Error al guardar producto', 'error');
    }
  };

  const handleToggleProductActive = async (product) => {
    const targetActive = !product.active;

    // 1. OPTIMISTIC UPDATE: instant UI feedback with zero lag!
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, active: targetActive } : p))
    );

    // Sync activePositioningProduct if currently viewed
    if (activePositioningProduct && activePositioningProduct.id === product.id) {
      setActivePositioningProduct((prev) => ({ ...prev, active: targetActive }));
    }

    try {
      if (targetActive) {
        await apiAdapter.restoreProduct(product.barcode);
        showToast('♻️ Producto reactivado', 'success');
      } else {
        await apiAdapter.archiveProduct(product.barcode);
        showToast('📦 Producto archivado', 'info');
      }

      // Refresh to ensure absolute consistency
      const updated = await apiAdapter.listProducts(true);
      setProducts(updated || []);
    } catch (err) {
      console.error('Error toggling product status:', err);
      // Revert optimistic update on failure
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, active: !targetActive } : p))
      );
      showToast('❌ Error al cambiar estado del producto', 'error');
    }
  };

  const handleUpdateProductLocation = async (barcode, newLoc) => {
    try {
      await apiAdapter.updateProductLocation(barcode, newLoc);
      showToast(newLoc ? `✅ Posición asignada: ${newLoc}` : 'ℹ️ Posición eliminada', 'success');

      // Update state
      setProducts((prev) =>
        prev.map((p) => (p.barcode === barcode ? { ...p, location: newLoc } : p))
      );
      if (activePositioningProduct && activePositioningProduct.barcode === barcode) {
        setActivePositioningProduct((prev) => ({ ...prev, location: newLoc }));
      }
    } catch (err) {
      console.error('Error updating product location:', err);
      showToast('❌ Error al actualizar ubicación', 'error');
    }
  };

  // --- Catalog Import & Barcode Linking ---
  const handleLinkBarcode = async (productId, barcodeToLink, optionalStock) => {
    try {
      await apiAdapter.linkBarcodeToProduct(productId, barcodeToLink);
      if (optionalStock !== null && optionalStock !== undefined && !isNaN(optionalStock)) {
        const targetProd = products.find((p) => p.id === productId);
        if (targetProd) {
          await apiAdapter.saveProduct({
            ...targetProd,
            barcode: barcodeToLink,
            stock: optionalStock,
          });
        }
      }
      setIsBarcodeLinkModalOpen(false);
      showToast(`✅ Código vinculado: ${barcodeToLink}`, 'success');

      const updated = await apiAdapter.listProducts(true);
      setProducts(updated || []);

      if (currentTab === 'pos') {
        const linkedProduct = (updated || []).find((p) => p.id === productId || p.barcode === barcodeToLink);
        if (linkedProduct) {
          playSoundChime(true);
          setLastScannedProduct(linkedProduct);
          setUnregisteredBarcode(null);
          setCart((prev) => {
            const existing = prev.find((item) => item.id === productId || item.barcode === barcodeToLink);
            if (existing) {
              return prev.map((item) =>
                item.id === productId || item.barcode === barcodeToLink
                  ? { ...item, qty: (item.qty || 1) + 1 }
                  : item
              );
            }
            return [...prev, { ...linkedProduct, qty: 1 }];
          });
        }
      }
    } catch (err) {
      console.error('Error linking barcode:', err);
      showToast(`❌ Error al vincular código: ${err.message || err}`, 'error');
      throw err;
    }
  };

  const handleImportCatalogCSV = async (csvContent) => {
    try {
      const res = await apiAdapter.importCatalogCSV(csvContent);
      const updated = await apiAdapter.listProducts(true);
      setProducts(updated || []);
      showToast(`✅ Catálogo importado: ${res.inserted || 0} nuevos, ${res.updated || 0} actualizados`, 'success');
      return res;
    } catch (err) {
      console.error('Error importing catalog CSV:', err);
      showToast(`❌ Error al importar catálogo: ${err.message || err}`, 'error');
      throw err;
    }
  };

  // --- Location Operations ---
  const handleSaveLocation = async (locData) => {
    try {
      await apiAdapter.saveLocation(locData);
      setIsLocationModalOpen(false);
      setEditingLocation(null);
      showToast('✅ Locación guardada', 'success');

      const locs = await apiAdapter.getAllLocations();
      setLocations(locs || []);
    } catch (err) {
      console.error('Error saving location:', err);
      showToast('❌ Error al guardar locación', 'error');
    }
  };

  const handleRequestDeleteLocation = (loc) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Locación',
      message: `¿Estás seguro de que deseas eliminar la locación "${loc.code} - ${loc.name}"? Los artículos asignados no se borrarán.`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try {
          await apiAdapter.deleteLocation(loc.id);
          showToast('🗑️ Locación eliminada', 'info');
          const locs = await apiAdapter.getAllLocations();
          setLocations(locs || []);
        } catch (err) {
          console.error('Error deleting location:', err);
          showToast('❌ Error al eliminar locación', 'error');
        }
      },
    });
  };

  // --- Shelf Operations ---
  const handleSaveShelf = async (shelfData) => {
    try {
      await apiAdapter.saveShelf(shelfData);
      setIsShelfModalOpen(false);
      setEditingShelf(null);
      showToast('✅ Estante guardado y posiciones generadas', 'success');

      const [shs, locs] = await Promise.all([
        apiAdapter.getAllShelves(),
        apiAdapter.getAllLocations(),
      ]);
      setShelves(shs || []);
      setLocations(locs || []);
    } catch (err) {
      console.error('Error saving shelf:', err);
      showToast('❌ Error al guardar estante: ' + (err.message || err), 'error');
    }
  };

  const handleRequestDeleteShelf = (shelf) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Estante',
      message: `¿Estás seguro de que deseas eliminar el estante "${shelf.code} - ${shelf.name}"? Las posiciones existentes no se borrarán si contienen artículos.`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try {
          await apiAdapter.deleteShelf(shelf.id);
          showToast('🗑️ Estante eliminado', 'info');
          const [shs, locs] = await Promise.all([
            apiAdapter.getAllShelves(),
            apiAdapter.getAllLocations(),
          ]);
          setShelves(shs || []);
          setLocations(locs || []);
        } catch (err) {
          console.error('Error deleting shelf:', err);
          showToast('❌ Error al eliminar estante: ' + (err.message || err), 'error');
        }
      },
    });
  };

  // --- CSV Export ---
  const handleExportCSV = async () => {
    try {
      // 1. Try native Windows save dialog
      const savedPath = await apiAdapter.exportInventoryCSVFile().catch(() => null);
      if (savedPath) {
        showToast(`💾 Exportado en: ${savedPath}`, 'success');
        window.focus();
        return;
      }

      // 2. Fallback to browser blob download
      const csvData = await apiAdapter.exportInventoryCSV();
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾 Inventario CSV descargado exitosamente', 'success');
    } catch (err) {
      console.error('Error exporting CSV:', err);
      showToast('❌ Error al exportar CSV', 'error');
    }
  };

  // --- Physical Inventory Audit Operations (Mode B) ---
  const handleStartAuditSession = async ({ name, responsible, scope, notes }) => {
    try {
      const sess = await apiAdapter.startInventorySession(name, responsible, scope, notes);
      setIsStartAuditModalOpen(false);
      setActiveAuditSession(sess);
      setCurrentTab('audit');
      showToast(`🚀 Toma "${sess.name}" iniciada`, 'success');

      const items = await apiAdapter.listInventorySessionItems(sess.id);
      setAuditItems(items || []);
    } catch (err) {
      console.error('Error starting inventory session:', err);
      showToast(`❌ Error al iniciar toma: ${err}`, 'error');
    }
  };

  const handleRecordAuditScan = async (barcode, locationCode) => {
    if (!activeAuditSession) return null;
    try {
      const updated = await apiAdapter.recordInventoryScan(
        activeAuditSession.id,
        barcode,
        locationCode
      );
      if (updated) {
        playSoundChime(true);
        setLastTouchedAuditItemId(updated.id);
        const items = await apiAdapter.listInventorySessionItems(activeAuditSession.id);
        setAuditItems(items || []);
      }
      return updated;
    } catch (err) {
      playSoundChime(false);
      const errStr = String(err?.message || err || '');
      if (errStr.includes('UNKNOWN_BARCODE:')) {
        const code = errStr.split('UNKNOWN_BARCODE:')[1] || barcode;
        showToast(`Código ${code} no registrado. Abriendo catálogo para crearlo...`, 'warning');
        setUnregisteredBarcode(code);
        setEditingProduct({ barcode: code, active: true });
        setIsProductModalOpen(true);
      } else {
        showToast(`❌ Error al registrar conteo: ${errStr}`, 'error');
      }
      throw err;
    }
  };

  const handleBatchAuditCount = async (sessionItemId, locationCode, qty, replace) => {
    try {
      await apiAdapter.recordBatchCount(sessionItemId, locationCode, qty, replace);
      showToast('✅ Conteo registrado exitosamente', 'success');
      if (activeAuditSession) {
        const items = await apiAdapter.listInventorySessionItems(activeAuditSession.id);
        setAuditItems(items || []);
      }
    } catch (err) {
      console.error('Error recording batch count:', err);
      showToast(`❌ Error al registrar lote: ${err}`, 'error');
    }
  };

  const handleUndoAuditCount = async (sessionItemId) => {
    try {
      await apiAdapter.undoLastCount(sessionItemId);
      showToast('↺ Último conteo deshecho', 'info');
      if (activeAuditSession) {
        const items = await apiAdapter.listInventorySessionItems(activeAuditSession.id);
        setAuditItems(items || []);
      }
    } catch (err) {
      console.error('Error undoing count:', err);
      showToast(`❌ Error al deshacer: ${err}`, 'error');
    }
  };

  const handleConfirmCloseAudit = async (productIdsToUpdate) => {
    if (!activeAuditSession) return;
    try {
      await apiAdapter.closeInventorySession(activeAuditSession.id, productIdsToUpdate);
      setIsReconciliationModalOpen(false);
      showToast('🏁 Toma de inventario finalizada y existencias ajustadas', 'success');

      // Refresh products from SQLite or local-first store
      const updatedProds = await apiAdapter.listProducts(true);
      setProducts(updatedProds || []);

      // Refresh active session and completed list
      setActiveAuditSession(null);
      setAuditItems([]);
      const completed = await apiAdapter.listCompletedInventorySessions();
      setCompletedAuditSessions(completed || []);
    } catch (err) {
      console.error('Error closing inventory session:', err);
      showToast(`❌ Error al finalizar inventario: ${err}`, 'error');
    }
  };

  const handleCancelAuditSession = () => {
    if (!activeAuditSession) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Cancelar Toma de Inventario',
      message: `¿Estás seguro de cancelar la toma "${activeAuditSession.name}"? Los conteos registrados serán descartados y el stock del catálogo quedará intacto.`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try {
          await apiAdapter.cancelInventorySession(activeAuditSession.id);
          setActiveAuditSession(null);
          setAuditItems([]);
          showToast('ℹ️ Toma de inventario cancelada', 'info');
          const completed = await apiAdapter.listCompletedInventorySessions();
          setCompletedAuditSessions(completed || []);
        } catch (err) {
          console.error('Error cancelling inventory session:', err);
          showToast(`❌ Error al cancelar toma: ${err}`, 'error');
        }
      },
    });
  };

  const handleExportSessionCSV = async (sessionId) => {
    const actualSessionId = (typeof sessionId === 'object') ? null : sessionId;
    const idToExport = actualSessionId || activeAuditSession?.id || completedAuditSessions[0]?.id;
    if (!idToExport) return;
    try {
      const savedPath = await apiAdapter.exportInventorySessionCSVFile(idToExport).catch(() => null);
      if (savedPath) {
        showToast(`💾 Reporte exportado en: ${savedPath}`, 'success');
        window.focus();
        return;
      }

      // Browser fallback
      const csvData = await apiAdapter.exportInventorySessionCSV(idToExport);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_toma_inventario_${idToExport}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾 Reporte CSV generado exitosamente', 'success');
    } catch (err) {
      console.error('Error exporting session CSV:', err);
      showToast('❌ Error al exportar reporte', 'error');
    }
  };

  // --- POS, Cash Shift and Settings Handlers ---
  const handleCompleteSale = async (saleInput, printReceipt) => {
    try {
      // Use apiAdapter to complete sale
      const sale = await apiAdapter.completeSale(saleInput);
      setLastCompletedSale(sale);
      setCart([]);
      playSoundChime(true);
      showToast(`✓ Venta #${sale.ticketNumber} registrada ($${sale.totalAmount?.toLocaleString()})`, 'success');

      // Refresh products to show updated live stock
      const prods = await apiAdapter.listProducts(true);
      setProducts(prods || []);

      // Refresh current shift
      if (apiAdapter.getCurrentCashShift) {
        const shift = await apiAdapter.getCurrentCashShift();
        setCurrentShift(shift || null);
      }

      setIsCheckoutModalOpen(false);
      
      // Print Receipt
      if (printReceipt) {
        sunmiHardware.printReceipt(sale, storeConfig).catch(err => console.error(err));
        // Also keep receipt modal for UI feedback if needed
        setIsReceiptModalOpen(true);
      }

      // Background sync
      syncService.syncSales([sale]).catch(console.error);

    } catch (err) {
      playSoundChime(false);
      showToast(`❌ Error al cobrar: ${err}`, 'error');
      throw err;
    }
  };

  const handleOpenShift = async (initialCash, notes) => {
    try {
      const shift = await apiAdapter.openCashShift(parseFloat(initialCash) || 0, notes || '');
      setCurrentShift(shift);
      playSoundChime(true);
      showToast(`🟢 Turno #${shift.id} abierto con base de $${shift.initialCash?.toLocaleString()}`, 'success');
      setIsCashShiftModalOpen(false);
    } catch (err) {
      playSoundChime(false);
      showToast(`❌ Error abriendo turno: ${err}`, 'error');
    }
  };

  const handleCloseShift = async (shiftId, actualCash, assimilateDifference, notes) => {
    try {
      const closed = await apiAdapter.closeCashShift(shiftId, parseFloat(actualCash) || 0, Boolean(assimilateDifference), notes || '');
      setCurrentShift(null);
      playSoundChime(true);
      showToast(`🔴 Turno cerrado exitosamente`, 'success');
      setIsCashShiftModalOpen(false);
    } catch (err) {
      playSoundChime(false);
      showToast(`❌ Error cerrando turno: ${err}`, 'error');
    }
  };

  const handleSaveStoreConfig = async (cfg) => {
    try {
      await apiAdapter.saveStoreConfig(cfg);
      setStoreConfig(cfg);
      playSoundChime(true);
      showToast('✓ Configuración de la tienda guardada', 'success');
      setIsSettingsModalOpen(false);
    } catch (err) {
      playSoundChime(false);
      showToast(`❌ Error guardando configuración: ${err}`, 'error');
    }
  };

  // --- Suppliers Operations ---
  const handleSaveSupplier = async (supData) => {
    try {
      await apiAdapter.saveSupplier(supData);
      setIsSupplierModalOpen(false);
      setEditingSupplier(null);
      showToast('✅ Proveedor guardado exitosamente', 'success');
      const updated = await apiAdapter.listSuppliers(false);
      setSuppliers(updated || []);
    } catch (err) {
      console.error('Error saving supplier:', err);
      showToast(`❌ Error al guardar proveedor: ${err}`, 'error');
    }
  };

  const handleDeleteSupplier = (supplierId) => {
    const target = suppliers.find((s) => s.id === supplierId);
    setConfirmDialog({
      isOpen: true,
      title: 'Desactivar Proveedor',
      message: `¿Estás seguro de que deseas desactivar al proveedor "${target?.name || ''}"?`,
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try {
          await apiAdapter.deleteSupplier(supplierId);
          showToast('🗑️ Proveedor desactivado', 'info');
          const updated = await apiAdapter.listSuppliers(false);
          setSuppliers(updated || []);
        } catch (err) {
          console.error('Error deleting supplier:', err);
          showToast(`❌ Error al desactivar proveedor: ${err}`, 'error');
        }
      },
    });
  };

  // --- Purchase Intake Operations ---
  const handleStartPurchase = (headerData) => {
    setActivePurchase({
      ...headerData,
      items: [],
    });
    showToast(`📥 Ingreso de factura #${headerData.invoiceNumber} iniciado`, 'info');
  };

  const handleAddItemToPurchase = (item) => {
    setActivePurchase((prev) => {
      if (!prev) return prev;
      const items = prev.items || [];
      const existingIdx = items.findIndex(
        (it) => it.barcode === item.barcode || (it.productId && it.productId === item.productId)
      );
      if (existingIdx >= 0) {
        const updated = [...items];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: (updated[existingIdx].qty || 1) + 1,
        };
        return { ...prev, items: updated };
      }
      return { ...prev, items: [item, ...items] };
    });
  };

  const handleUpdateItemInPurchase = (index, field, value) => {
    setActivePurchase((prev) => {
      if (!prev) return prev;
      const updated = [...(prev.items || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleRemoveItemFromPurchase = (index) => {
    setActivePurchase((prev) => {
      if (!prev) return prev;
      return { ...prev, items: (prev.items || []).filter((_, idx) => idx !== index) };
    });
  };

  const handleFinalizePurchase = async (purchaseData) => {
    try {
      const res = await apiAdapter.createPurchase({
        supplierId: parseInt(purchaseData.supplierId, 10),
        invoiceNumber: purchaseData.invoiceNumber,
        invoiceDate: purchaseData.invoiceDate,
        paymentStatus: purchaseData.paymentMethod || 'Contado',
        totalCost: parseFloat(purchaseData.totalCost) || 0,
        attachmentPath: purchaseData.attachmentPath || '',
        notes: purchaseData.notes || '',
        items: (purchaseData.items || []).map((it) => ({
          productId: it.productId,
          barcode: it.barcode,
          productName: it.productName || it.name,
          qty: it.qty,
          unitCost: it.unitCost,
          suggestedPrice: it.suggestedPrice || 0,
        })),
      });
      setActivePurchase(null);
      playSoundChime(true);
      showToast(`✅ Factura #${res.invoiceNumber || 'de compra'} ingresada a inventario`, 'success');

      // Refresh products and reports
      const prods = await apiAdapter.listProducts(true);
      setProducts(prods || []);
      const rep = await apiAdapter.getFinancialReports(currentReportPeriod);
      if (rep) setReportData(rep);
    } catch (err) {
      playSoundChime(false);
      console.error('Error finalizing purchase:', err);
      showToast(`❌ Error al ingresar factura: ${err}`, 'error');
    }
  };

  const handleCancelPurchase = () => {
    setActivePurchase(null);
    showToast('ℹ️ Ingreso de factura cancelado', 'info');
  };

  // --- Reports Operations ---
  const handleFetchReports = async (period) => {
    setCurrentReportPeriod(period);
    try {
      const rep = await apiAdapter.getFinancialReports(period);
      if (rep) setReportData(rep);
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const handleExportReportCSV = async (period) => {
    try {
      if (!reportData) return;
      const csvLines = [
        `REPORTE FINANCIERO - PERIODO: ${period.toUpperCase()}`,
        `Fecha de generacion,${new Date().toLocaleString('es-CO')}`,
        `Total Ventas,$${reportData.totalSales || 0}`,
        `Numero de Ventas,${reportData.salesCount || 0}`,
        `Ticket Promedio,$${reportData.averageTicket || 0}`,
        `Total Compras,$${reportData.totalPurchases || 0}`,
        `Facturas de Compra,${reportData.purchasesCount || 0}`,
        `Margen Bruto,$${reportData.grossMargin || 0} (${(reportData.grossMarginPct || 0).toFixed(1)}%)`,
        `Tope DIAN 3500 UVT,$${reportData.dianUvtThreshold || 0}`,
        `Porcentaje Consumido,${(reportData.dianCurrentPct || 0).toFixed(1)}%`,
      ];
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_financiero_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾 Reporte financiero exportado en CSV', 'success');
    } catch (err) {
      console.error('Error exporting report CSV:', err);
      showToast('❌ Error exportando reporte', 'error');
    }
  };

  const auditStats = useMemo(() => {
    if (!activeAuditSession || !auditItems.length) return null;
    const total = auditItems.length;
    const counted = auditItems.filter((it) => it.isCounted).length;
    const percentage = total > 0 ? Math.round((counted / total) * 100) : 0;
    return { total, counted, percentage };
  }, [activeAuditSession, auditItems]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        scannerStatus={scannerStatus}
        availablePorts={availablePorts}
        currentPort={currentPort}
        onPortChange={handlePortChange}
        onRefreshPorts={handleRefreshPorts}
        onProductSelect={(prod) => {
          if (currentTab === 'audit') {
            showToast(`🔍 ${prod.name} | Stock actual: ${prod.stock} | Ubic: ${prod.location || 'Sin ubicación'}`, 'info');
            return;
          }
          handleIncomingScan({ found: true, barcode: prod.barcode, product: prod });
        }}
        activeAuditSession={activeAuditSession}
        auditStats={auditStats}
        currentShift={currentShift}
        onOpenShiftModal={() => setIsCashShiftModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
      />

      {/* Main Content Views */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '18px' }}>
        {currentTab === 'pos' && (
          <POSView
            products={products}
            cart={cart}
            setCart={setCart}
            lastScannedProduct={lastScannedProduct}
            unregisteredBarcode={unregisteredBarcode}
            onRegisterProduct={handleSaveProduct}
            onClearCart={() => setCart([])}
            onOpenCheckout={() => setIsCheckoutModalOpen(true)}
            onClearLastScanned={() => {
              setLastScannedProduct(null);
              setUnregisteredBarcode(null);
            }}
            onOpenBarcodeLink={(bc) => {
              setPendingBarcodeToLink(bc);
              setIsBarcodeLinkModalOpen(true);
            }}
          />
        )}

        {currentTab === 'positioning' && (
          <PositioningView
            activeProduct={activePositioningProduct}
            locations={locations}
            shelves={shelves}
            onUpdateLocation={handleUpdateProductLocation}
            onOpenCreateProduct={(code) => {
              setEditingProduct({ barcode: code, active: true });
              setIsProductModalOpen(true);
            }}
          />
        )}

        {currentTab === 'inventory' && (
          <InventoryView
            products={products}
            onOpenNewProduct={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            onEditProduct={(prod) => {
              setEditingProduct(prod);
              setIsProductModalOpen(true);
            }}
            onToggleActive={handleToggleProductActive}
            onExportCSV={handleExportCSV}
            onImportCSV={handleImportCatalogCSV}
            onOpenBarcodeLink={(prod) => {
              setPendingBarcodeToLink(prod.barcode || '');
              setIsBarcodeLinkModalOpen(true);
            }}
          />
        )}

        {currentTab === 'locations' && (
          <LocationsView
            locations={locations}
            shelves={shelves}
            onOpenNewShelf={() => {
              setEditingShelf(null);
              setIsShelfModalOpen(true);
            }}
            onEditShelf={(sh) => {
              setEditingShelf(sh);
              setIsShelfModalOpen(true);
            }}
            onRequestDeleteShelf={handleRequestDeleteShelf}
            onOpenNewLocation={() => {
              setEditingLocation(null);
              setIsLocationModalOpen(true);
            }}
            onEditLocation={(loc) => {
              setEditingLocation(loc);
              setIsLocationModalOpen(true);
            }}
            onRequestDeleteLocation={handleRequestDeleteLocation}
          />
        )}

        {currentTab === 'purchases' && (
          <PurchaseIntakeView
            suppliers={suppliers.filter((s) => s.active)}
            products={products}
            activePurchase={activePurchase}
            onStartPurchase={handleStartPurchase}
            onAddItemToPurchase={handleAddItemToPurchase}
            onUpdateItemInPurchase={handleUpdateItemInPurchase}
            onRemoveItemFromPurchase={handleRemoveItemFromPurchase}
            onFinalizePurchase={handleFinalizePurchase}
            onCancelPurchase={handleCancelPurchase}
          />
        )}

        {currentTab === 'suppliers' && (
          <SuppliersView
            suppliers={suppliers}
            onOpenNewSupplier={() => {
              setEditingSupplier(null);
              setIsSupplierModalOpen(true);
            }}
            onEditSupplier={(sup) => {
              setEditingSupplier(sup);
              setIsSupplierModalOpen(true);
            }}
            onDeleteSupplier={handleDeleteSupplier}
          />
        )}

        {currentTab === 'reports' && (
          <ReportsView
            reportData={reportData}
            onFetchReport={handleFetchReports}
            onExportReportCSV={handleExportReportCSV}
          />
        )}

        {currentTab === 'audit' && (
          <StockAuditView
            session={activeAuditSession}
            items={auditItems}
            completedSessions={completedAuditSessions}
            locations={locations}
            activeLocationCode={auditLocationCode}
            setActiveLocationCode={setAuditLocationCode}
            lastTouchedItemId={lastTouchedAuditItemId}
            setLastTouchedItemId={setLastTouchedAuditItemId}
            onStartSession={() => setIsStartAuditModalOpen(true)}
            onOpenFinishAudit={() => setIsReconciliationModalOpen(true)}
            onCancelSession={handleCancelAuditSession}
            onRecordScan={handleRecordAuditScan}
            onBatchCount={handleBatchAuditCount}
            onUndoLastCount={handleUndoAuditCount}
            onExportSessionCSV={handleExportSessionCSV}
            onRefresh={async () => {
              if (activeAuditSession) {
                const items = await apiAdapter.listInventorySessionItems(activeAuditSession.id);
                setAuditItems(items || []);
              }
            }}
          />
        )}
      </main>

      {/* Modals - Unmounted when closed to eliminate any click traps! */}
      {isProductModalOpen && (
        <ProductModal
          isOpen={isProductModalOpen}
          product={editingProduct}
          locations={locations}
          onSave={handleSaveProduct}
          isStockLocked={Boolean(activeAuditSession)}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
            window.focus();
          }}
        />
      )}

      {isLocationModalOpen && (
        <LocationModal
          isOpen={isLocationModalOpen}
          location={editingLocation}
          onSave={handleSaveLocation}
          onClose={() => {
            setIsLocationModalOpen(false);
            setEditingLocation(null);
            window.focus();
          }}
        />
      )}

      {isShelfModalOpen && (
        <ShelfModal
          isOpen={isShelfModalOpen}
          shelf={editingShelf}
          onSave={handleSaveShelf}
          onClose={() => {
            setIsShelfModalOpen(false);
            setEditingShelf(null);
            window.focus();
          }}
        />
      )}

      {isStartAuditModalOpen && (
        <StartAuditModal
          isOpen={isStartAuditModalOpen}
          locations={locations}
          shelves={shelves}
          onStart={handleStartAuditSession}
          onClose={() => {
            setIsStartAuditModalOpen(false);
            window.focus();
          }}
        />
      )}

      {isReconciliationModalOpen && (
        <AuditReconciliationModal
          isOpen={isReconciliationModalOpen}
          session={activeAuditSession}
          items={auditItems}
          onConfirmClose={handleConfirmCloseAudit}
          onExportCSV={(id) => handleExportSessionCSV(id || activeAuditSession?.id)}
          onClose={() => {
            setIsReconciliationModalOpen(false);
            window.focus();
          }}
        />
      )}

      {confirmDialog.isOpen && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          isDanger={confirmDialog.isDanger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => {
            setConfirmDialog({ isOpen: false });
            window.focus();
          }}
        />
      )}

      {/* POS Checkout & Sale Modals */}
      {isCheckoutModalOpen && (
        <CheckoutModal
          isOpen={isCheckoutModalOpen}
          onClose={() => {
            setIsCheckoutModalOpen(false);
            window.focus();
          }}
          cart={cart}
          totalAmount={cart.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0)}
          storeConfig={storeConfig}
          currentShift={currentShift}
          onCompleteSale={handleCompleteSale}
        />
      )}

      {isReceiptModalOpen && lastCompletedSale && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            window.focus();
          }}
          sale={lastCompletedSale}
          storeConfig={storeConfig}
        />
      )}

      {isCashShiftModalOpen && (
        <CashShiftModal
          isOpen={isCashShiftModalOpen}
          onClose={() => {
            setIsCashShiftModalOpen(false);
            window.focus();
          }}
          currentShift={currentShift}
          storeConfig={storeConfig}
          onOpenShift={handleOpenShift}
          onCloseShift={handleCloseShift}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => {
            setIsSettingsModalOpen(false);
            window.focus();
          }}
          currentConfig={storeConfig}
          onSaveConfig={handleSaveStoreConfig}
        />
      )}

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <SupplierModal
          isOpen={isSupplierModalOpen}
          supplier={editingSupplier}
          onSave={handleSaveSupplier}
          onClose={() => {
            setIsSupplierModalOpen(false);
            setEditingSupplier(null);
            window.focus();
          }}
        />
      )}

      {/* Hardware / Scanner Hub Modal */}
      {isHardwareModalOpen && (
        <HardwareModal
          isOpen={isHardwareModalOpen}
          onClose={() => {
            setIsHardwareModalOpen(false);
            window.focus();
          }}
          scannerStatus={scannerStatus}
          availablePorts={availablePorts}
          currentPort={currentPort}
          onPortChange={handlePortChange}
          onRefreshPorts={handleRefreshPorts}
        />
      )}

      {/* Barcode Linking Modal (Pistoleo de Enlace) */}
      <BarcodeLinkModal
        isOpen={isBarcodeLinkModalOpen}
        barcode={pendingBarcodeToLink}
        products={products}
        onLink={handleLinkBarcode}
        onCreateNew={(bc) => {
          setIsBarcodeLinkModalOpen(false);
          setEditingProduct({ barcode: bc, active: true });
          setIsProductModalOpen(true);
        }}
        onClose={() => setIsBarcodeLinkModalOpen(false)}
      />

      {/* Toast Feedback */}
      <Toast toast={toast} />
    </div>
  );
}
