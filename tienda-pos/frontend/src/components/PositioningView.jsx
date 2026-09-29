import React, { useState, useEffect } from 'react';

// Lightweight singleton audio synthesizer for instant interactive feedback
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
    // AudioContext blocked or unsupported, silently ignore
  }
}

export default function PositioningView({
  activeProduct,
  locations = [],
  shelves = [],
  onUpdateLocation,
  onOpenCreateProduct,
}) {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [activeShelfCode, setActiveShelfCode] = useState('');
  const [shelfOccupancy, setShelfOccupancy] = useState({});
  const [viewMode, setViewMode] = useState('graphic'); // 'graphic' or 'manual'

  // Initialize or detect shelf from active product
  useEffect(() => {
    if (activeProduct) {
      setSelectedLocation(activeProduct.location || '');
      setCustomLocation(activeProduct.location || '');

      // Check if product's location matches one of the shelves (e.g. EST01-N1-C1 starts with EST01)
      if (activeProduct.location && shelves.length > 0) {
        const prodLoc = activeProduct.location.toUpperCase();
        const matchedShelf = shelves.find((sh) => prodLoc.startsWith(sh.code.toUpperCase()));
        if (matchedShelf) {
          setActiveShelfCode(matchedShelf.code);
        } else if (!activeShelfCode && shelves.length > 0) {
          setActiveShelfCode(shelves[0].code);
        }
      } else if (!activeShelfCode && shelves.length > 0) {
        setActiveShelfCode(shelves[0].code);
      }
    } else {
      setSelectedLocation('');
      setCustomLocation('');
    }
  }, [activeProduct, shelves]);

  // Load occupancy when active shelf changes
  useEffect(() => {
    let isMounted = true;
    async function loadOccupancy() {
      if (!activeShelfCode) return;
      try {
        if (window.go && window.go.main && window.go.main.App && window.go.main.App.GetShelfOccupancy) {
          const occ = await window.go.main.App.GetShelfOccupancy(activeShelfCode);
          if (isMounted) {
            setShelfOccupancy(occ || {});
          }
        }
      } catch (err) {
        console.error('Error loading shelf occupancy:', err);
      }
    }
    loadOccupancy();
    return () => {
      isMounted = false;
    };
  }, [activeShelfCode, activeProduct]);

  // Current active shelf object
  const currentShelf = shelves.find((sh) => sh.code === activeShelfCode) || shelves[0];

  // Click on a casilla in the visual shelf
  const handleSlotClick = async (slotCode) => {
    if (!activeProduct) return;
    playChime(true);
    setCustomLocation(slotCode);
    setSelectedLocation(slotCode);
    await onUpdateLocation(activeProduct.barcode, slotCode);
  };

  const handleSelectChange = (e) => {
    const val = e.target.value;
    setSelectedLocation(val);
    if (val) {
      setCustomLocation(val);
    }
  };

  const handleSavePosition = () => {
    if (!activeProduct) return;
    playChime(true);
    onUpdateLocation(activeProduct.barcode, customLocation.trim());
  };

  const handleClearPosition = () => {
    if (!activeProduct) return;
    playChime(true);
    setSelectedLocation('');
    setCustomLocation('');
    onUpdateLocation(activeProduct.barcode, '');
  };

  return (
    <div className="pos-layout">
      {/* Left Column: Scanned Product Details */}
      <section className="panel">
        <div className="panel-title">Detalle del Artículo</div>

        {activeProduct ? (
          <div style={{ width: '100%', textAlign: 'left', padding: '10px 14px' }}>
            <span
              className={`status-pill ${
                activeProduct.active ? 'status-pill-active' : 'status-pill-archived'
              }`}
            >
              {activeProduct.active ? 'Activo' : 'Archivado'}
            </span>

            <h2 style={{ fontSize: '22px', margin: '8px 0' }}>{activeProduct.name}</h2>
            <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#64748b', marginBottom: '14px' }}>
              Código: {activeProduct.barcode}
            </div>

            <div
              className="grid-3"
              style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
              }}
            >
              <div>
                <span style={{ color: '#64748b', fontSize: '11px' }}>PRECIO VENTA</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  ${(activeProduct.price || 0).toLocaleString('es-CO')}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px' }}>PRECIO COSTO</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>
                  ${(activeProduct.costPrice || 0).toLocaleString('es-CO')}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px' }}>STOCK ACTUAL</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>
                  {activeProduct.stock} {activeProduct.unitOfMeasure || 'und'}
                </div>
              </div>
            </div>

            <div className="grid-2" style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
              <div>
                <strong>Contenido / Medida:</strong>{' '}
                {activeProduct.weight > 0
                  ? `${activeProduct.weight} ${activeProduct.unitOfMeasure || ''}`.trim()
                  : 'N/A'}
              </div>
              <div>
                <strong>Tamaño / Color:</strong>{' '}
                {activeProduct.size || activeProduct.color
                  ? `${activeProduct.size || ''} ${activeProduct.color || ''}`.trim()
                  : 'N/A'}
              </div>
            </div>

            {/* Current Position Display Box */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#166534', textTransform: 'uppercase', marginBottom: '4px' }}>
                📍 Ubicación Actual en Tienda
              </div>
              {activeProduct.location && activeProduct.location.trim() !== '' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '16px', color: '#15803d' }}>
                    {activeProduct.location}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-clear"
                    onClick={handleClearPosition}
                    title="Desvincular ubicación actual"
                    style={{ color: '#ef4444', fontSize: '12px', padding: '2px 8px' }}
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <div style={{ color: '#b45309', fontSize: '13px', fontWeight: 600 }}>
                  ⚠️ Sin ubicación asignada. Selecciona una casilla a la derecha.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              color: '#94a3b8',
              padding: '20px',
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔍</div>
            <p style={{ fontSize: '14px', maxWidth: '300px', lineHeight: 1.4 }}>
              Escanea un código de barras con la pistola o búscalo arriba para reubicarlo en el mapa del estante.
            </p>
          </div>
        )}
      </section>

      {/* Right Column: Visual Shelf Selector & Fast Slot Assignment */}
      <section className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Mapa Gráfico de Estantes & Posicionamiento</span>
          
          {/* Mode Switch: Graphic Shelf vs Manual Code */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
            <button
              type="button"
              onClick={() => setViewMode('graphic')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'graphic' ? '#fff' : 'transparent',
                color: viewMode === 'graphic' ? '#2563eb' : '#64748b',
                boxShadow: viewMode === 'graphic' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              📐 Gráfico Interactivo
            </button>
            <button
              type="button"
              onClick={() => setViewMode('manual')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'manual' ? '#fff' : 'transparent',
                color: viewMode === 'manual' ? '#2563eb' : '#64748b',
                boxShadow: viewMode === 'manual' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              ✍️ Texto / Manual
            </button>
          </div>
        </div>

        {/* GRAPHIC VIEW MODE */}
        {viewMode === 'graphic' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            
            {/* Shelf Selection Tabs Bar */}
            {shelves.length > 0 ? (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  SELECCIONA EL ESTANTE:
                </div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {shelves.map((sh) => {
                    const isSelected = (currentShelf && currentShelf.code === sh.code);
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => setActiveShelfCode(sh.code)}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: isSelected ? '#eff6ff' : '#fff',
                          color: isSelected ? '#1d4ed8' : '#334155',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500,
                          whiteSpace: 'nowrap',
                          boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.15)' : 'none',
                        }}
                      >
                        <span>🗄️</span>
                        <span>{sh.code}</span>
                        <span style={{ fontSize: '11px', color: isSelected ? '#3b82f6' : '#94a3b8' }}>
                          ({sh.name})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', marginBottom: '14px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 8px 0' }}>
                  No tienes estantes estructurados creados. Ve a <strong>🏷️ Locaciones</strong> para crear tu primera estantería con niveles y casillas.
                </p>
              </div>
            )}

            {/* Visual Interactive Shelf Container */}
            {currentShelf ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '3px solid #334155',
                    borderRadius: '10px',
                    padding: '14px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '8px', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                        {currentShelf.name}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', marginLeft: '8px' }}>
                        [{currentShelf.code}]
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      👉 Haz clic en una casilla para ubicar el producto
                    </span>
                  </div>

                  {/* Render Levels (Top to Bottom order) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'space-around' }}>
                    {(() => {
                      let levels = currentShelf.levels || [];
                      if (levels.length === 0 && currentShelf.levelsJson) {
                        try {
                          levels = JSON.parse(currentShelf.levelsJson);
                        } catch (e) {
                          levels = [];
                        }
                      }
                      const displayLevels = [...levels].sort((a, b) => b.level - a.level);

                      return displayLevels.map((lvl) => (
                        <div key={lvl.level} style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', fontWeight: 700, marginBottom: '4px' }}>
                            <span>Nivel {lvl.level}</span>
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>
                              {lvl.slots} {lvl.slots === 1 ? 'casilla' : 'casillas'}
                            </span>
                          </div>

                          {/* Casillas Grid */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${lvl.slots}, 1fr)`,
                              gap: '8px',
                            }}
                          >
                            {Array.from({ length: lvl.slots }).map((_, slotIdx) => {
                              const slotNum = slotIdx + 1;
                              const slotCode = `${currentShelf.code}-N${lvl.level}-C${slotNum}`;
                              const isCurrentLocation = activeProduct && activeProduct.location === slotCode;
                              const occ = shelfOccupancy[slotCode];
                              const productCount = occ ? occ.productCount : 0;
                              const totalStock = occ ? occ.totalStock : 0;

                              return (
                                <button
                                  key={slotNum}
                                  type="button"
                                  onClick={() => handleSlotClick(slotCode)}
                                  disabled={!activeProduct}
                                  style={{
                                    border: isCurrentLocation
                                      ? '2px solid #16a34a'
                                      : '1.5px solid #cbd5e1',
                                    background: isCurrentLocation
                                      ? '#f0fdf4'
                                      : '#fff',
                                    borderRadius: '8px',
                                    padding: '10px 6px',
                                    cursor: activeProduct ? 'pointer' : 'not-allowed',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    transition: 'all 0.15s ease',
                                    boxShadow: isCurrentLocation
                                      ? '0 0 0 3px rgba(22, 163, 74, 0.2)'
                                      : '0 1px 3px rgba(0,0,0,0.05)',
                                    opacity: !activeProduct ? 0.7 : 1,
                                  }}
                                  title={`Clic para ubicar en ${slotCode}`}
                                >
                                  {/* Slot Code Header */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: isCurrentLocation ? '#15803d' : '#0f172a', fontFamily: 'monospace' }}>
                                      C{slotNum}
                                    </span>
                                    {isCurrentLocation && (
                                      <span style={{ fontSize: '10px', background: '#16a34a', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                        ★ AQUÍ
                                      </span>
                                    )}
                                  </div>

                                  {/* Full code */}
                                  <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                                    {slotCode}
                                  </span>

                                  {/* Occupancy Indicator */}
                                  <div style={{ marginTop: '2px' }}>
                                    {productCount > 0 ? (
                                      <span style={{ fontSize: '10px', color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>
                                        📦 {productCount} {productCount === 1 ? 'prod' : 'prods'} ({totalStock})
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                        Vacío
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Shelf Plank Beam */}
                          <div
                            style={{
                              height: '7px',
                              background: 'linear-gradient(180deg, #64748b 0%, #334155 100%)',
                              borderRadius: '2px',
                              marginTop: '8px',
                              boxShadow: '0 2px 3px rgba(0,0,0,0.1)',
                            }}
                          />
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Ground Level Base */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 24px', marginTop: '6px' }}>
                    <div style={{ width: '16px', height: '12px', background: '#334155', borderRadius: '0 0 4px 4px' }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>Piso / Suelo</span>
                    <div style={{ width: '16px', height: '12px', background: '#334155', borderRadius: '0 0 4px 4px' }} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* MANUAL VIEW MODE */}
        {viewMode === 'manual' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="form-group" style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Seleccionar de la lista de posiciones:
                </label>
                <select value={selectedLocation} onChange={handleSelectChange}>
                  <option value="">-- Elige una posición --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.code}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  O escanear / digitar código de ubicación física:
                </label>
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Ej: EST-01-N1-C2 o BODEGA-A"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  💡 Si tus estantes tienen códigos de barra impresos, pistolea la etiqueta del estante aquí.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleSavePosition}
                disabled={!activeProduct}
                style={{ flex: 1 }}
              >
                💾 Guardar Nueva Posición
              </button>
              <button
                type="button"
                className="btn btn-clear"
                onClick={handleClearPosition}
                disabled={!activeProduct}
              >
                Quitar Posición
              </button>
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
