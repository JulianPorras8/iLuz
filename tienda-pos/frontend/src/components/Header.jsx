import React, { useState, useEffect, useRef } from 'react';
import syncService from '../services/syncService';

export default function Header({
  currentTab,
  setCurrentTab,
  scannerStatus,
  onProductSelect,
  activeAuditSession,
  auditStats,
  currentShift,
  onOpenShiftModal,
  onOpenSettingsModal,
  onOpenHardwareModal,
}) {
  const [quickQuery, setQuickQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);
  
  const [syncStatus, setSyncStatus] = useState({ isConnected: false, lastSyncTime: null });

  useEffect(() => {
    const handleSyncStatus = (e) => {
      setSyncStatus({ isConnected: e.detail.isConnected, lastSyncTime: e.detail.lastSyncTime });
    };
    window.addEventListener('sync-status-changed', handleSyncStatus);
    
    // Initial check
    syncService.checkConnection().then(res => {
       setSyncStatus({ isConnected: res.isOnline, lastSyncTime: syncService.lastSyncTimestamp });
    });

    return () => window.removeEventListener('sync-status-changed', handleSyncStatus);
  }, []);

  useEffect(() => {
    if (!quickQuery.trim() || quickQuery.trim().length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (window.go?.main?.App?.SearchProducts) {
        try {
          const results = await window.go.main.App.SearchProducts(quickQuery.trim());
          setSearchResults(results || []);
          setIsDropdownOpen((results || []).length > 0);
        } catch (err) {
          console.error('Error searching products in header:', err);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [quickQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleItemClick = (product) => {
    setIsDropdownOpen(false);
    setQuickQuery('');
    if (onProductSelect) {
      onProductSelect(product);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const code = quickQuery.trim();
      if (code && window.go?.main?.App?.ProcessBarcode) {
        setIsDropdownOpen(false);
        setQuickQuery('');
        window.go.main.App.ProcessBarcode(code);
      }
    }
  };

  const isConnected = scannerStatus?.connected;
  const statusPort = scannerStatus?.port || 'COM';

  const navItems = [
    { id: 'pos', label: '🛒 Caja', hotkey: 'F1' },
    { id: 'inventory', label: '📦 Inventario', hotkey: 'F2' },
    { id: 'positioning', label: '📍 Locaciones', hotkey: 'F3' },
    { id: 'purchases', label: '📥 Entradas', hotkey: 'F4' },
    { id: 'suppliers', label: '🚚 Proveedores', hotkey: 'F5' },
    { id: 'reports', label: '📊 Reportes', hotkey: 'F6' },
    { id: 'audit', label: '📋 Auditoría' },
  ];

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, overflow: 'hidden' }}>
        <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '20px', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap' }}>
          <span>⚡ iLuz</span>
        </div>

        {/* Scrollable Navigation Suite Tabs */}
        <nav
          className="nav-tabs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            padding: '2px 0',
          }}
        >
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => setCurrentTab(item.id)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#fff' : '#94a3b8',
                  background: isActive ? '#2563eb' : '#1e293b',
                  border: '1px solid',
                  borderColor: isActive ? '#3b82f6' : '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                title={item.hotkey ? `Atajo: ${item.hotkey}` : undefined}
              >
                <span>{item.label}</span>
                {item.id === 'audit' && activeAuditSession && (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#22c55e',
                    }}
                    title="Toma de inventario en progreso"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {activeAuditSession && (
          <div
            onClick={() => setCurrentTab('audit')}
            style={{
              cursor: 'pointer',
              backgroundColor: '#064e3b',
              border: '1px solid #059669',
              color: '#a7f3d0',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
            title="Clic para ir a la toma de inventario activa"
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }} />
            <span>Toma: <strong>{activeAuditSession.name}</strong></span>
            {auditStats && (
              <span style={{ color: '#ecfdf5', background: '#047857', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                {auditStats.counted}/{auditStats.total} ({auditStats.percentage}%)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Quick Search */}
        <div className="search-box-container" ref={searchContainerRef} style={{ position: 'relative', width: '220px' }}>
          <input
            type="text"
            className="quick-input"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="🔍 Buscar producto..."
            title="Escanea un código o escribe para buscar"
            autoComplete="off"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              borderRadius: '6px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
            }}
          />

          {isDropdownOpen && (
            <div className="search-dropdown" style={{ display: 'block', position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1e293b', border: '1px solid #475569', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {searchResults.map((p) => (
                <div
                  key={p.id || p.barcode}
                  className="search-dropdown-item"
                  onClick={() => handleItemClick(p)}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #334155' }}
                >
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span>{p.barcode} {p.location ? `• 📍 ${p.location}` : ''}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>${(p.price || 0).toLocaleString('es-CO')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sync Status Button */}
        <button
          type="button"
          onClick={() => {
            syncService.syncNow().then(success => {
              if (success) {
                alert('Sincronización completada');
              } else {
                onOpenSettingsModal();
              }
            });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            background: syncStatus.isConnected ? '#064e3b' : '#450a0a',
            border: `1px solid ${syncStatus.isConnected ? '#059669' : '#dc2626'}`,
            color: syncStatus.isConnected ? '#6ee7b7' : '#fca5a5',
          }}
          title={syncStatus.isConnected ? `Sincronizado: ${syncStatus.lastSyncTime ? new Date(parseInt(syncStatus.lastSyncTime)).toLocaleTimeString() : 'Reciente'}` : 'Sincronización desconectada. Clic para configurar'}
        >
          <span>{syncStatus.isConnected ? '🟢 Sync' : (syncStatus.lastSyncTime ? '🟡 Sync (Offline)' : '🔴 Sync Error')}</span>
        </button>

        {/* Hardware & Scanner Hub Button */}
        <button
          type="button"
          onClick={onOpenHardwareModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            background: isConnected ? '#064e3b' : '#450a0a',
            border: `1px solid ${isConnected ? '#059669' : '#dc2626'}`,
            color: isConnected ? '#6ee7b7' : '#fca5a5',
          }}
          title={isConnected ? `Escáner conectado en ${statusPort}` : 'Escáner desconectado. Clic para configurar'}
        >
          <span>🔌 Escáner</span>
          <span>{isConnected ? '🟢' : '🔴'}</span>
        </button>

        {/* Cash Shift Status Button */}
        <div
          onClick={onOpenShiftModal}
          style={{
            cursor: 'pointer',
            backgroundColor: currentShift ? '#064e3b' : '#7f1d1d',
            border: currentShift ? '1px solid #059669' : '1px solid #b91c1c',
            color: currentShift ? '#a7f3d0' : '#fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
          }}
          title={currentShift ? `Efectivo en gaveta: $${Number(currentShift.expectedCash || 0).toLocaleString('es-CO')}` : 'Caja cerrada, clic para abrir turno'}
        >
          <span>{currentShift ? '🟢 Caja Abierta' : '🔴 Caja Cerrada'}</span>
        </div>

        {/* Settings Gear Button */}
        <button
          type="button"
          onClick={onOpenSettingsModal}
          title="Configuración General"
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '6px 10px',
            color: '#f8fafc',
          }}
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
