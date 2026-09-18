import React, { useState, useEffect, useRef } from 'react';

export default function Header({
  currentTab,
  setCurrentTab,
  scannerStatus,
  availablePorts,
  currentPort,
  onPortChange,
  onRefreshPorts,
  onProductSelect,
  activeAuditSession,
  auditStats,
}) {
  const [quickQuery, setQuickQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);

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
  const statusPort = scannerStatus?.port || currentPort || 'COM';

  let badgeText = 'Buscando Orbit...';
  let badgeTitle = 'Desconectado';

  if (isConnected) {
    badgeText = `Orbit Conectado (${statusPort})`;
    badgeTitle = `Lector conectado en ${statusPort} (9600 baud, 8N1).`;
  } else if (scannerStatus?.error) {
    if (scannerStatus.error.includes('No se detectaron') || scannerStatus.error.includes('not found')) {
      badgeText = `${statusPort} no encontrado`;
    } else if (scannerStatus.error.includes('Access is denied') || scannerStatus.error.includes('busy')) {
      badgeText = `${statusPort} en uso`;
    } else {
      badgeText = `Reconectando ${statusPort}...`;
    }
    badgeTitle = `${statusPort}: ${scannerStatus.error}`;
  }

  return (
    <header>
      <div className="header-left">
        <div className="brand-title">
          <span>⚡ iLuz</span>
        </div>

        <nav className="nav-tabs">
          <button
            type="button"
            className={`nav-tab ${currentTab === 'pos' ? 'active' : ''}`}
            onClick={() => setCurrentTab('pos')}
          >
            🛒 Caja / POS
          </button>
          <button
            type="button"
            className={`nav-tab ${currentTab === 'positioning' ? 'active' : ''}`}
            onClick={() => setCurrentTab('positioning')}
          >
            📍 Posicionamiento
          </button>
          <button
            type="button"
            className={`nav-tab ${currentTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setCurrentTab('inventory')}
          >
            📦 Inventario
          </button>
          <button
            type="button"
            className={`nav-tab ${currentTab === 'locations' ? 'active' : ''}`}
            onClick={() => setCurrentTab('locations')}
          >
            🏷️ Locaciones
          </button>
          <button
            type="button"
            className={`nav-tab ${currentTab === 'audit' ? 'active' : ''}`}
            onClick={() => setCurrentTab('audit')}
            style={activeAuditSession ? { borderColor: '#10b981', color: '#10b981' } : {}}
          >
            📋 Toma de Inventario
            {activeAuditSession && (
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  marginLeft: '4px',
                }}
                title="Toma de inventario en progreso"
              />
            )}
          </button>
        </nav>

        {activeAuditSession && (
          <div
            onClick={() => setCurrentTab('audit')}
            style={{
              cursor: 'pointer',
              backgroundColor: '#064e3b',
              border: '1px solid #059669',
              color: '#a7f3d0',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '8px',
            }}
            title="Clic para ir a la toma de inventario activa"
          >
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }} />
            <span>Toma Activa: <strong>{activeAuditSession.name}</strong></span>
            {auditStats && (
              <span style={{ color: '#ecfdf5', background: '#047857', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                {auditStats.counted}/{auditStats.total} ({auditStats.percentage}%)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="header-right">
        <div className="search-box-container" ref={searchContainerRef}>
          <input
            type="text"
            className="quick-input"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="🔍 Buscar nombre o código..."
            title="Escanea un código o escribe el nombre para buscar"
            autoComplete="off"
          />

          {isDropdownOpen && (
            <div className="search-dropdown" style={{ display: 'block' }}>
              {searchResults.map((p) => (
                <div
                  key={p.id || p.barcode}
                  className="search-dropdown-item"
                  onClick={() => handleItemClick(p)}
                >
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {p.barcode} {p.location ? `• 📍 ${p.location}` : ''}
                    </span>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                      ${(p.price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="port-controls">
          <select
            className="port-select"
            value={currentPort}
            onChange={(e) => onPortChange(e.target.value)}
            title="Seleccionar puerto COM del escáner"
          >
            {availablePorts.length > 0 ? (
              availablePorts.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))
            ) : (
              <option value="">{currentPort || 'Sin puertos COM'}</option>
            )}
          </select>

          <button
            type="button"
            className="btn-icon"
            onClick={onRefreshPorts}
            title="Refrescar puertos COM"
          >
            🔄
          </button>
        </div>

        <div
          className={`badge ${isConnected ? 'badge-on' : 'badge-off'}`}
          title={badgeTitle}
        >
          <span>{badgeText}</span>
        </div>
      </div>
    </header>
  );
}
