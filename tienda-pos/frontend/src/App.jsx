import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Header from './components/Header.jsx';
import POSView from './components/POSView.jsx';
import PositioningView from './components/PositioningView.jsx';
import InventoryView from './components/InventoryView.jsx';
import LocationsView from './components/LocationsView.jsx';
import StockAuditView from './components/StockAuditView.jsx';
import ProductModal from './components/ProductModal.jsx';
import LocationModal from './components/LocationModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import StartAuditModal from './components/StartAuditModal.jsx';
import AuditReconciliationModal from './components/AuditReconciliationModal.jsx';
import Toast from './components/Toast.jsx';

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

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isDanger: false,
  });

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
    if (!window.go?.main?.App) return;

    try {
      const [status, ports, port, locs, prods, activeSess, completedSess] = await Promise.all([
        window.go.main.App.GetScannerStatus ? window.go.main.App.GetScannerStatus() : null,
        window.go.main.App.GetAvailablePorts ? window.go.main.App.GetAvailablePorts() : [],
        window.go.main.App.GetCurrentPort ? window.go.main.App.GetCurrentPort() : 'COM3',
        window.go.main.App.GetAllLocations ? window.go.main.App.GetAllLocations() : [],
        window.go.main.App.ListInventoryProducts ? window.go.main.App.ListInventoryProducts(true) : [],
        window.go.main.App.GetActiveInventorySession ? window.go.main.App.GetActiveInventorySession() : null,
        window.go.main.App.ListCompletedInventorySessions ? window.go.main.App.ListCompletedInventorySessions() : [],
      ]);

      if (status) setScannerStatus(status);
      setAvailablePorts(ports || []);
      setCurrentPort(port || 'COM3');
      setLocations(locs || []);
      setProducts(prods || []);
      setActiveAuditSession(activeSess || null);
      setCompletedAuditSessions(completedSess || []);

      if (activeSess && window.go?.main?.App?.ListInventorySessionItems) {
        const items = await window.go.main.App.ListInventorySessionItems(activeSess.id);
        setAuditItems(items || []);
      }
    } catch (err) {
      console.error('Error loading initial data from Wails:', err);
      showToast('Error cargando datos de inicio', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    let retries = 15;
    const interval = setInterval(() => {
      if (window.go?.main?.App) {
        clearInterval(interval);
        loadInitialData();
      } else if (retries <= 0) {
        clearInterval(interval);
      }
      retries--;
    }, 150);

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
          setUnregisteredBarcode(barcode);
          setLastScannedProduct(null);
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
          showToast(`Producto encontrado: ${product.name}`, 'success');
        } else {
          showToast(`Código no registrado: ${barcode}`, 'warning');
          setEditingProduct({ barcode, active: true });
          setIsProductModalOpen(true);
        }
      } else if (currentTab === 'audit') {
        if (activeAuditSession) {
          (async () => {
            try {
              const updated = await window.go.main.App.RecordInventoryScan(
                activeAuditSession.id,
                barcode,
                auditLocationCode
              );
              if (updated) {
                showToast(`+1 en ${auditLocationCode}: ${updated.productName}`, 'success');
                const items = await window.go.main.App.ListInventorySessionItems(activeAuditSession.id);
                setAuditItems(items || []);
              }
            } catch (err) {
              const errStr = String(err || '');
              if (errStr.includes('UNKNOWN_BARCODE:')) {
                const unknownCode = errStr.split('UNKNOWN_BARCODE:')[1] || barcode;
                showToast(`Código ${unknownCode} no registrado. Abriendo catálogo para crearlo...`, 'warning');
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
      }
    },
    [currentTab, activeAuditSession, auditLocationCode, showToast]
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
        if (sess && window.go?.main?.App?.ListInventorySessionItems) {
          const items = await window.go.main.App.ListInventorySessionItems(sess.id);
          setAuditItems(items || []);
        } else {
          setAuditItems([]);
        }
        if (window.go?.main?.App?.ListCompletedInventorySessions) {
          const completed = await window.go.main.App.ListCompletedInventorySessions();
          setCompletedAuditSessions(completed || []);
        }
      });

      const unbindItemCounted = window.runtime.EventsOn('inventory:item_counted', async () => {
        if (activeAuditSession?.id && window.go?.main?.App?.ListInventorySessionItems) {
          const items = await window.go.main.App.ListInventorySessionItems(activeAuditSession.id);
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
      if (isProductModalOpen || isLocationModalOpen || confirmDialog.isOpen) {
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
          if (window.go?.main?.App?.ProcessBarcode) {
            window.go.main.App.ProcessBarcode(scannedCode);
          }
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        keyBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProductModalOpen, isLocationModalOpen, confirmDialog.isOpen]);

  // --- Port Switching ---
  const handlePortChange = async (newPort) => {
    setCurrentPort(newPort);
    if (window.go?.main?.App?.SetScannerPort) {
      try {
        await window.go.main.App.SetScannerPort(newPort);
        showToast(`Cambiando puerto a ${newPort}...`, 'info');
      } catch (err) {
        console.error('Error changing port:', err);
        showToast(`Error conectando a ${newPort}`, 'error');
      }
    }
  };

  const handleRefreshPorts = async () => {
    if (window.go?.main?.App) {
      try {
        const [ports, cur] = await Promise.all([
          window.go.main.App.GetAvailablePorts(),
          window.go.main.App.GetCurrentPort(),
        ]);
        setAvailablePorts(ports || []);
        if (cur) setCurrentPort(cur);
        showToast('Puertos COM actualizados', 'info');
      } catch (err) {
        console.error('Error refreshing ports:', err);
      }
    }
  };

  // --- Product Operations ---
  const handleSaveProduct = async (prodData) => {
    try {
      await window.go.main.App.SaveProduct(prodData);
      setIsProductModalOpen(false);
      setEditingProduct(null);
      showToast('✅ Producto guardado exitosamente', 'success');

      // Refresh products from SQLite
      const updated = await window.go.main.App.ListInventoryProducts(true);
      setProducts(updated || []);

      // If registered from POS unregistered prompt
      if (unregisteredBarcode && prodData.barcode === unregisteredBarcode) {
        const fresh = (updated || []).find((p) => p.barcode === prodData.barcode);
        if (fresh) {
          setCart((prev) => [...prev, { ...fresh, qty: 1 }]);
          setLastScannedProduct(fresh);
          setUnregisteredBarcode(null);
        }
      }

      // Refresh audit items if session active
      if (activeAuditSession && window.go?.main?.App?.ListInventorySessionItems) {
        const freshAuditItems = await window.go.main.App.ListInventorySessionItems(activeAuditSession.id);
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
        await window.go.main.App.RestoreProduct(product.barcode);
        showToast('♻️ Producto reactivado', 'success');
      } else {
        await window.go.main.App.ArchiveProduct(product.barcode);
        showToast('📦 Producto archivado', 'info');
      }

      // Refresh to ensure absolute consistency with SQLite
      const updated = await window.go.main.App.ListInventoryProducts(true);
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
      await window.go.main.App.UpdateProductLocation(barcode, newLoc);
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

  // --- Location Operations ---
  const handleSaveLocation = async (locData) => {
    try {
      await window.go.main.App.SaveLocation(locData);
      setIsLocationModalOpen(false);
      setEditingLocation(null);
      showToast('✅ Locación guardada', 'success');

      const locs = await window.go.main.App.GetAllLocations();
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
          await window.go.main.App.DeleteLocation(loc.id);
          showToast('🗑️ Locación eliminada', 'info');
          const locs = await window.go.main.App.GetAllLocations();
          setLocations(locs || []);
        } catch (err) {
          console.error('Error deleting location:', err);
          showToast('❌ Error al eliminar locación', 'error');
        }
      },
    });
  };

  // --- CSV Export ---
  const handleExportCSV = async () => {
    try {
      // 1. Try native Windows save dialog
      const savedPath = await window.go?.main?.App?.ExportInventoryCSVFile().catch(() => null);
      if (savedPath) {
        showToast(`💾 Exportado en: ${savedPath}`, 'success');
        window.focus();
        return;
      }

      // 2. Fallback to browser blob download
      const csvData = await window.go.main.App.ExportInventoryCSV();
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
      const sess = await window.go.main.App.StartInventorySession(name, responsible, scope, notes);
      setIsStartAuditModalOpen(false);
      setActiveAuditSession(sess);
      setCurrentTab('audit');
      showToast(`🚀 Toma "${sess.name}" iniciada`, 'success');

      const items = await window.go.main.App.ListInventorySessionItems(sess.id);
      setAuditItems(items || []);
    } catch (err) {
      console.error('Error starting inventory session:', err);
      showToast(`❌ Error al iniciar toma: ${err}`, 'error');
    }
  };

  const handleRecordAuditScan = async (barcode, locationCode) => {
    if (!activeAuditSession) return null;
    try {
      const updated = await window.go.main.App.RecordInventoryScan(
        activeAuditSession.id,
        barcode,
        locationCode
      );
      const items = await window.go.main.App.ListInventorySessionItems(activeAuditSession.id);
      setAuditItems(items || []);
      return updated;
    } catch (err) {
      const errStr = String(err || '');
      if (errStr.includes('UNKNOWN_BARCODE:')) {
        const code = errStr.split('UNKNOWN_BARCODE:')[1] || barcode;
        showToast(`Código ${code} no registrado. Abriendo catálogo para crearlo...`, 'warning');
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
      await window.go.main.App.RecordBatchCount(sessionItemId, locationCode, qty, replace);
      showToast('✅ Conteo registrado exitosamente', 'success');
      if (activeAuditSession) {
        const items = await window.go.main.App.ListInventorySessionItems(activeAuditSession.id);
        setAuditItems(items || []);
      }
    } catch (err) {
      console.error('Error recording batch count:', err);
      showToast(`❌ Error al registrar lote: ${err}`, 'error');
    }
  };

  const handleUndoAuditCount = async (sessionItemId) => {
    try {
      await window.go.main.App.UndoLastCount(sessionItemId);
      showToast('↺ Último conteo deshecho', 'info');
      if (activeAuditSession) {
        const items = await window.go.main.App.ListInventorySessionItems(activeAuditSession.id);
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
      await window.go.main.App.CloseInventorySession(activeAuditSession.id, productIdsToUpdate);
      setIsReconciliationModalOpen(false);
      showToast('🏁 Toma de inventario finalizada y existencias ajustadas', 'success');

      // Refresh products from SQLite to show updated stock
      const updatedProds = await window.go.main.App.ListInventoryProducts(true);
      setProducts(updatedProds || []);

      // Refresh active session and completed list
      setActiveAuditSession(null);
      setAuditItems([]);
      const completed = await window.go.main.App.ListCompletedInventorySessions();
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
          await window.go.main.App.CancelInventorySession(activeAuditSession.id);
          setActiveAuditSession(null);
          setAuditItems([]);
          showToast('ℹ️ Toma de inventario cancelada', 'info');
          const completed = await window.go.main.App.ListCompletedInventorySessions();
          setCompletedAuditSessions(completed || []);
        } catch (err) {
          console.error('Error cancelling inventory session:', err);
          showToast(`❌ Error al cancelar toma: ${err}`, 'error');
        }
      },
    });
  };

  const handleExportSessionCSV = async (sessionId) => {
    const idToExport = sessionId || activeAuditSession?.id;
    if (!idToExport) return;
    try {
      const savedPath = await window.go?.main?.App?.ExportInventorySessionCSVFile(idToExport).catch(() => null);
      if (savedPath) {
        showToast(`💾 Reporte exportado en: ${savedPath}`, 'success');
        window.focus();
        return;
      }

      // Browser fallback
      const csvData = await window.go.main.App.ExportInventorySessionCSV(idToExport);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_toma_inventario_${idToExport}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾 Reporte CSV descargado', 'success');
    } catch (err) {
      console.error('Error exporting session CSV:', err);
      showToast('❌ Error al exportar reporte', 'error');
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
          handleIncomingScan({ found: true, barcode: prod.barcode, product: prod });
        }}
        activeAuditSession={activeAuditSession}
        auditStats={auditStats}
      />

      {/* Main Content Views */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '18px' }}>
        {currentTab === 'pos' && (
          <POSView
            cart={cart}
            setCart={setCart}
            lastScannedProduct={lastScannedProduct}
            unregisteredBarcode={unregisteredBarcode}
            onRegisterProduct={handleSaveProduct}
            onClearCart={() => setCart([])}
          />
        )}

        {currentTab === 'positioning' && (
          <PositioningView
            activeProduct={activePositioningProduct}
            locations={locations}
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
          />
        )}

        {currentTab === 'locations' && (
          <LocationsView
            locations={locations}
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

        {currentTab === 'audit' && (
          <StockAuditView
            session={activeAuditSession}
            items={auditItems}
            completedSessions={completedAuditSessions}
            locations={locations}
            activeLocationCode={auditLocationCode}
            setActiveLocationCode={setAuditLocationCode}
            onStartSession={() => setIsStartAuditModalOpen(true)}
            onOpenFinishAudit={() => setIsReconciliationModalOpen(true)}
            onCancelSession={handleCancelAuditSession}
            onRecordScan={handleRecordAuditScan}
            onBatchCount={handleBatchAuditCount}
            onUndoLastCount={handleUndoAuditCount}
            onExportSessionCSV={handleExportSessionCSV}
            onRefresh={async () => {
              if (activeAuditSession) {
                const items = await window.go.main.App.ListInventorySessionItems(activeAuditSession.id);
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

      {isStartAuditModalOpen && (
        <StartAuditModal
          isOpen={isStartAuditModalOpen}
          locations={locations}
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
          onExportCSV={() => handleExportSessionCSV(activeAuditSession?.id)}
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

      {/* Toast Feedback */}
      <Toast toast={toast} />
    </div>
  );
}
