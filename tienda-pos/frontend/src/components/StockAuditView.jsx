import React, { useState, useEffect, useRef, useMemo } from 'react';

// Singleton AudioContext synthesizer for scanner ergonomics without leaking contexts
let audioCtxSingleton = null;
function playChime(success = true) {
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
      gain.gain.setValueAtTime(0.12, audioCtxSingleton.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxSingleton.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtxSingleton.destination);
      osc.start();
      osc.stop(audioCtxSingleton.currentTime + 0.08);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, audioCtxSingleton.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtxSingleton.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxSingleton.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtxSingleton.destination);
      osc.start();
      osc.stop(audioCtxSingleton.currentTime + 0.15);
    }
  } catch (e) {
    // AudioContext blocked or unsupported, silently fail
  }
}

export default function StockAuditView({
  session,
  items = [],
  completedSessions = [],
  locations = [],
  activeLocationCode,
  setActiveLocationCode,
  lastTouchedItemId: propLastTouchedItemId,
  setLastTouchedItemId: propSetLastTouchedItemId,
  onStartSession,
  onOpenFinishAudit,
  onCancelSession,
  onRecordScan,
  onBatchCount,
  onUndoLastCount,
  onExportSessionCSV,
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'pending', 'counted', 'differences'
  const [customLocation, setCustomLocation] = useState('');
  const [isCustomLoc, setIsCustomLoc] = useState(false);

  // Scan input ref
  const scanInputRef = useRef(null);
  const [scanBarcodeInput, setScanBarcodeInput] = useState('');

  // Batch Count Modal state (F2)
  const [batchModalItem, setBatchModalItem] = useState(null);
  const [batchQty, setBatchQty] = useState('');
  const [batchReplace, setBatchReplace] = useState(true);
  const batchInputRef = useRef(null);

  // Tracking last touched item for Undo (support both prop or internal state)
  const [internalLastTouchedItemId, setInternalLastTouchedItemId] = useState(null);
  const lastTouchedItemId = propLastTouchedItemId !== undefined ? propLastTouchedItemId : internalLastTouchedItemId;
  const setLastTouchedItemId = propSetLastTouchedItemId || setInternalLastTouchedItemId;

  // Compute Active Location String
  const currentCountLocation = isCustomLoc
    ? (customLocation.trim() || 'GENERAL')
    : (activeLocationCode || 'EST-A1');

  // Statistics
  const stats = useMemo(() => {
    if (!items || items.length === 0) {
      return { total: 0, counted: 0, pending: 0, differences: 0, percentage: 0 };
    }
    const total = items.length;
    const counted = items.filter((it) => it.isCounted).length;
    const pending = total - counted;
    const differences = items.filter((it) => it.isCounted && it.variance !== 0).length;
    const percentage = total > 0 ? Math.round((counted / total) * 100) : 0;
    return { total, counted, pending, differences, percentage };
  }, [items]);

  // Filtered and searched items
  const displayedItems = useMemo(() => {
    let result = items;

    // Filter mode
    if (filterMode === 'pending') {
      result = result.filter((it) => !it.isCounted);
    } else if (filterMode === 'counted') {
      result = result.filter((it) => it.isCounted);
    } else if (filterMode === 'differences') {
      result = result.filter((it) => it.isCounted && it.variance !== 0);
    }

    // Search text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          it.productName.toLowerCase().includes(q) ||
          it.barcode.toLowerCase().includes(q) ||
          (it.location && it.location.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, filterMode, searchQuery]);

  // Keyboard shortcut listener (F2 for batch count, Escape to close modal)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (session && items.length > 0) {
          // Target currently filtered item, or last touched item, or first item
          const target = (lastTouchedItemId && items.find((it) => it.id === lastTouchedItemId))
            || (displayedItems.length > 0 ? displayedItems[0] : items[0]);
          if (target) {
            setBatchModalItem(target);
            setBatchQty('');
            setBatchReplace(true); // Default to replace mode (Spec Rule 5)
          }
        }
      } else if (e.key === 'Escape' && batchModalItem) {
        setBatchModalItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, items, displayedItems, lastTouchedItemId, batchModalItem]);

  // Focus batch input when modal opens
  useEffect(() => {
    if (batchModalItem && batchInputRef.current) {
      setTimeout(() => batchInputRef.current?.focus(), 50);
    }
  }, [batchModalItem]);

  // Handle Quick Scan Submit
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const code = scanBarcodeInput.trim();
    if (!code) return;

    try {
      const updated = await onRecordScan(code, currentCountLocation);
      if (updated) {
        playChime(true);
        setLastTouchedItemId(updated.id);
        setScanBarcodeInput('');
      }
    } catch (err) {
      playChime(false);
    }
  };

  // Quick +1 button on item row
  const handleQuickAddOne = async (item) => {
    try {
      const updated = await onRecordScan(item.barcode, currentCountLocation);
      if (updated) {
        playChime(true);
        setLastTouchedItemId(item.id);
      }
    } catch (err) {
      playChime(false);
    }
  };

  // Open Batch Count Modal for specific item
  const handleOpenBatch = (item) => {
    setBatchModalItem(item);
    setBatchQty('');
    setBatchReplace(true);
  };

  // Submit Batch Count
  const handleSubmitBatch = async (e) => {
    e.preventDefault();
    if (!batchModalItem) return;

    const qtyNum = parseInt(batchQty, 10);
    if (isNaN(qtyNum) || qtyNum < 0) return;

    try {
      await onBatchCount(batchModalItem.id, currentCountLocation, qtyNum, batchReplace);
      playChime(true);
      setLastTouchedItemId(batchModalItem.id);
      setBatchModalItem(null);
    } catch (err) {
      playChime(false);
    }
  };

  // Undo Last Scan
  const handleUndo = async () => {
    if (!lastTouchedItemId) return;
    try {
      await onUndoLastCount(lastTouchedItemId);
      playChime(true);
    } catch (err) {
      playChime(false);
    }
  };

  // ==========================================
  // RENDER: INACTIVE STATE (History & Start)
  // ==========================================
  if (!session) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {/* Banner Hero */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#fff',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '26px' }}>📋</span>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Toma de Inventario Físico (Auditoría de Stock)
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '650px', lineHeight: 1.5, margin: 0 }}>
              Realiza el conteo físico de tus productos sin interrumpir la operación. Puedes pausar y continuar
              durante días. Al finalizar, podrás conciliar diferencias y actualizar el stock oficial selectivamente.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartSession}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 700,
              backgroundColor: '#10b981',
              borderColor: '#059669',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ➕ Iniciar Nueva Toma de Inventario
          </button>
        </div>

        {/* Informative Step Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>📸 1. Snapshot Automático</div>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
              Al iniciar, el sistema congela el stock actual como línea base de comparación. Puedes contar a tu ritmo
              sin perder el punto de partida.
            </p>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>📍 2. Conteo Multizona</div>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
              Cuenta en Estantes y luego en Bodega. El sistema suma automáticamente los conteos de cada ubicación sin
              sobrescribirse ni confundirse.
            </p>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🛡️ 3. Conciliación Segura</div>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
              Al terminar, revisas discrepancias y decides cuáles actualizar. Los productos que no contaste quedan intactos y
              nunca se ponen en cero.
            </p>
          </div>
        </div>

        {/* Completed Sessions Table */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '20px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '14px' }}>
            📜 Historial de Tomas de Inventario Realizadas
          </h3>

          <div className="table-container" style={{ flex: 1, border: '1px solid #f1f5f9', borderRadius: '6px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>NOMBRE DE LA SESIÓN</th>
                  <th style={{ width: '130px' }}>RESPONSABLE</th>
                  <th style={{ width: '130px' }}>ALCANCE</th>
                  <th style={{ width: '150px' }}>FECHA INICIO</th>
                  <th style={{ width: '150px' }}>FECHA FIN</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>ESTADO</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {completedSessions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No hay tomas de inventario archivadas todavía. ¡Inicia la primera cuando estés listo!
                    </td>
                  </tr>
                ) : (
                  completedSessions.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#64748b' }}>#{s.id}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</td>
                      <td style={{ color: '#475569' }}>{s.responsible || 'Sin especificar'}</td>
                      <td>
                        <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                          {s.scope === 'ALL' ? 'Toda la Tienda' : `Zona: ${s.scope}`}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{s.startedAt?.slice(0, 16).replace('T', ' ')}</td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{(s.closedAt || s.endedAt)?.slice(0, 16).replace('T', ' ') || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: s.status === 'completed' ? '#dcfce7' : '#fee2e2',
                            color: s.status === 'completed' ? '#15803d' : '#991b1b',
                          }}
                        >
                          {s.status === 'completed' ? 'Completado' : 'Cancelado'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => onExportSessionCSV(s.id)}
                          title="Descargar reporte detallado en CSV"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          💾 Reporte CSV
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: ACTIVE SESSION VIEW
  // ==========================================
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
      {/* 1. Header Card with Session Details & Actions */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '14px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {session.name}
              </h2>
              <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                {session.scope === 'ALL' ? 'Alcance: Toda la Tienda' : `Zona: ${session.scope}`}
              </span>
              {session.responsible && (
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  • Operador: <strong>{session.responsible}</strong>
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Iniciado el {session.startedAt?.slice(0, 16).replace('T', ' ')} • Los cambios en stock oficial se aplicarán al finalizar
            </div>
          </div>

          {/* Master Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancelSession}
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              title="Cancelar sesión de inventario descartando conteos"
            >
              ❌ Cancelar Toma
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenFinishAudit}
              style={{
                backgroundColor: '#059669',
                borderColor: '#047857',
                fontWeight: 700,
                padding: '8px 16px',
                fontSize: '13px',
              }}
            >
              🏁 Finalizar Inventario ({stats.counted} contados)
            </button>
          </div>
        </div>

        {/* Progress Bar & Counters */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>
              Avance del Conteo: <strong>{stats.counted}</strong> de {stats.total} productos ({stats.percentage}%)
            </span>
            <span style={{ color: stats.differences > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
              {stats.differences > 0 ? `⚠️ ${stats.differences} con diferencias` : '✓ Sin diferencias reportadas'}
            </span>
          </div>

          <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${stats.percentage}%`,
                height: '100%',
                backgroundColor: stats.percentage === 100 ? '#10b981' : '#3b82f6',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Operational Scanning Control Bar (Location Selector + Quick Scan + F2 + Undo) */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '14px',
          flexShrink: 0,
        }}
      >
        {/* Zone Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
            📍 Contando en:
          </label>
          <select
            className="form-control"
            value={isCustomLoc ? 'CUSTOM' : activeLocationCode}
            onChange={(e) => {
              if (e.target.value === 'CUSTOM') {
                setIsCustomLoc(true);
                setActiveLocationCode(customLocation.trim() || 'GENERAL');
              } else {
                setIsCustomLoc(false);
                setActiveLocationCode(e.target.value);
              }
            }}
            style={{ width: 'auto', minWidth: '160px', padding: '6px 10px', fontSize: '13px', fontWeight: 600 }}
          >
            {locations && locations.length > 0 ? (
              locations.map((loc) => (
                <option key={loc.id} value={loc.code}>
                  {loc.code} - {loc.name}
                </option>
              ))
            ) : (
              <>
                <option value="EST-A1">EST-A1 (Estante A1)</option>
                <option value="BOD-01">BOD-01 (Bodega Principal)</option>
                <option value="TIENDA">TIENDA (Piso de Venta)</option>
              </>
            )}
            <option value="CUSTOM">➕ Otra ubicación manual...</option>
          </select>

          {isCustomLoc && (
            <input
              type="text"
              className="form-control"
              placeholder="Ej. BODEGA-2"
              value={customLocation}
              onChange={(e) => {
                setCustomLocation(e.target.value);
                setActiveLocationCode(e.target.value.trim() || 'GENERAL');
              }}
              style={{ width: '130px', padding: '6px 8px', fontSize: '13px' }}
              autoFocus
            />
          )}
        </div>

        {/* Barcode Quick Scan Input */}
        <form onSubmit={handleScanSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '260px' }}>
          <input
            ref={scanInputRef}
            type="text"
            className="form-control"
            value={scanBarcodeInput}
            onChange={(e) => setScanBarcodeInput(e.target.value)}
            placeholder="⚡ Escanear o escribir código de barras..."
            style={{ padding: '7px 12px', fontSize: '13px', fontFamily: 'monospace' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
            +1 Contar
          </button>
        </form>

        {/* Fast Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (items.length > 0) {
                handleOpenBatch(displayedItems[0] || items[0]);
              }
            }}
            title="Ingresar cantidad grande o caja directamente (Atajo: F2)"
            style={{ fontSize: '12px', fontWeight: 600 }}
          >
            📦 Lote / Manual (F2)
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleUndo}
            disabled={!lastTouchedItemId}
            title="Deshacer el último escaneo registrado"
            style={{ fontSize: '12px', color: lastTouchedItemId ? '#b45309' : '#94a3b8' }}
          >
            ↺ Deshacer
          </button>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('all')}
          >
            Todos ({stats.total})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterMode === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('pending')}
          >
            Pendientes ({stats.pending})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterMode === 'counted' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('counted')}
          >
            Contados ({stats.counted})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterMode === 'differences' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('differences')}
          >
            Con Diferencia ({stats.differences})
          </button>
        </div>

        <div style={{ width: '280px' }}>
          <input
            type="text"
            className="form-control"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Filtrar lista por nombre o código..."
            style={{ padding: '5px 10px', fontSize: '12px' }}
          />
        </div>
      </div>

      {/* 4. Live Session Table */}
      <div
        className="table-container"
        style={{
          flex: 1,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflowY: 'auto',
        }}
      >
        <table>
          <thead>
            <tr>
              <th style={{ width: '100px', textAlign: 'center' }}>ESTADO</th>
              <th>PRODUCTO / CÓDIGO</th>
              <th style={{ width: '160px' }}>UBICACIÓN & DESGLOSE</th>
              <th style={{ width: '85px', textAlign: 'right' }}>SISTEMA</th>
              <th style={{ width: '95px', textAlign: 'right' }}>FÍSICO</th>
              <th style={{ width: '90px', textAlign: 'right' }}>DIFERENCIA</th>
              <th style={{ width: '160px', textAlign: 'right' }}>ACCIONES RÁPIDAS</th>
            </tr>
          </thead>
          <tbody>
            {displayedItems.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No se encontraron productos con el filtro aplicado.
                </td>
              </tr>
            ) : (
              displayedItems.map((it) => {
                const isDiff = it.isCounted && it.variance !== 0;
                const isTouched = it.id === lastTouchedItemId;

                return (
                  <tr
                    key={it.id}
                    style={{
                      background: isTouched ? '#fefce8' : undefined,
                      transition: 'background 0.3s',
                    }}
                  >
                    <td style={{ textAlign: 'center' }}>
                      {!it.isCounted ? (
                        <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '10px', fontWeight: 600 }}>
                          Pendiente
                        </span>
                      ) : isDiff ? (
                        <span
                          style={{
                            fontSize: '11px',
                            background: it.variance < 0 ? '#fee2e2' : '#dbeafe',
                            color: it.variance < 0 ? '#991b1b' : '#1e40af',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontWeight: 700,
                          }}
                        >
                          {it.variance > 0 ? `+${it.variance}` : it.variance}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '10px', fontWeight: 700 }}>
                          ✓ Coincide
                        </span>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.productName}</div>
                      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                        {it.barcode}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '12px', color: '#334155' }}>
                        {it.location || 'Sin ubicación'}
                      </div>
                      {it.breakdown && (
                        <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                          📍 {it.breakdown}
                        </div>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                      {it.systemStockAtStart}
                    </td>

                    <td
                      style={{
                        textAlign: 'right',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: it.isCounted ? '#0f172a' : '#94a3b8',
                      }}
                    >
                      {it.isCounted ? it.countedQty : '-'}
                    </td>

                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: !it.isCounted ? '#94a3b8' : it.variance < 0 ? '#dc2626' : it.variance > 0 ? '#16a34a' : '#64748b',
                      }}
                    >
                      {!it.isCounted ? '-' : it.variance > 0 ? `+${it.variance}` : it.variance}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleQuickAddOne(it)}
                          title={`+1 en ${currentCountLocation}`}
                          style={{ padding: '3px 8px', fontSize: '12px', fontWeight: 700 }}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleOpenBatch(it)}
                          title="Digitar cantidad o lote"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          Lote
                        </button>
                        {it.isCounted && (
                          <button
                            type="button"
                            className="btn btn-sm btn-clear"
                            onClick={() => onUndoLastCount(it.id)}
                            title="Deshacer último conteo"
                            style={{ padding: '3px 6px', fontSize: '11px', color: '#b45309' }}
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Batch Count Dialog / Modal */}
      {batchModalItem && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBatchModalItem(null);
          }}
        >
          <div className="modal-card" style={{ width: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '15px' }}>📦 Conteo por Lote / Manual</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setBatchModalItem(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '16px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitBatch}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                    {batchModalItem.productName}
                  </div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b' }}>
                    {batchModalItem.barcode} • Ubicación: <strong>{currentCountLocation}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Cantidad de unidades a registrar *:
                  </label>
                  <input
                    ref={batchInputRef}
                    type="number"
                    min="0"
                    className="form-control"
                    value={batchQty}
                    onChange={(e) => setBatchQty(e.target.value)}
                    placeholder="Ej. 12, 24, 50..."
                    required
                    autoFocus
                    style={{ fontSize: '16px', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <input
                    type="checkbox"
                    id="replace-mode"
                    checked={batchReplace}
                    onChange={(e) => setBatchReplace(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="replace-mode" style={{ fontSize: '12px', color: '#334155', cursor: 'pointer', margin: 0 }}>
                    <strong>Reemplazar conteo</strong> en esta ubicación ({currentCountLocation}) en vez de sumar
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setBatchModalItem(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!batchQty}>
                  Guardar Conteo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
