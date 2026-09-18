import React, { useState, useEffect } from 'react';

export default function PositioningView({
  activeProduct,
  locations,
  onUpdateLocation,
  onOpenCreateProduct,
}) {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');

  useEffect(() => {
    if (activeProduct) {
      setSelectedLocation(activeProduct.location || '');
      setCustomLocation(activeProduct.location || '');
    } else {
      setSelectedLocation('');
      setCustomLocation('');
    }
  }, [activeProduct]);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    setSelectedLocation(val);
    if (val) {
      setCustomLocation(val);
    }
  };

  const handleSavePosition = () => {
    if (!activeProduct) return;
    onUpdateLocation(activeProduct.barcode, customLocation.trim());
  };

  const handleClearPosition = () => {
    if (!activeProduct) return;
    setSelectedLocation('');
    setCustomLocation('');
    onUpdateLocation(activeProduct.barcode, '');
  };

  return (
    <div className="pos-layout">
      {/* Left: Scanned Product Details */}
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
                <span style={{ color: '#64748b', fontSize: '11px' }}>PRECIO</span>
                <div style={{ fontSize: '16px', fontWeight: 800 }}>
                  ${(activeProduct.price || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px' }}>STOCK</span>
                <div style={{ fontSize: '16px', fontWeight: 800 }}>
                  {activeProduct.stock} {activeProduct.unitOfMeasure || 'und'}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px' }}>PESO</span>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  {activeProduct.weight > 0 ? `${activeProduct.weight} kg` : 'N/A'}
                </div>
              </div>
            </div>

            <div className="grid-2" style={{ fontSize: '13px', color: '#475569' }}>
              <div>
                <strong>Tamaño:</strong> {activeProduct.size || 'No especificado'}
              </div>
              <div>
                <strong>Color:</strong> {activeProduct.color || 'No especificado'}
              </div>
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
            <p style={{ fontSize: '15px' }}>
              Escanea un código de barras o busca arriba para ver y reubicar su posición física en la tienda.
            </p>
          </div>
        )}
      </section>

      {/* Right: Location Assignment */}
      <section className="panel">
        <div className="panel-title">Asignación de Posición Física</div>

        {activeProduct ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Posición actual registrada:</div>
              {activeProduct.location && activeProduct.location.trim() !== '' ? (
                <div className="loc-badge-large loc-badge-active">
                  📍 {activeProduct.location}
                </div>
              ) : (
                <div className="loc-badge-large loc-badge-empty">
                  ⚠️ Sin ubicación asignada
                </div>
              )}

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>Seleccionar de Locaciones Predefinidas:</label>
                <select value={selectedLocation} onChange={handleSelectChange}>
                  <option value="">-- Elige una locación --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={`${loc.code} - ${loc.name}`}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>O digitar Posición / Código Personalizado:</label>
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Ej: Pasillo 2 - Estante C - Nivel 1"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleSavePosition}
                style={{ flex: 1 }}
              >
                💾 Guardar Nueva Posición
              </button>
              <button
                type="button"
                className="btn btn-clear"
                onClick={handleClearPosition}
              >
                Quitar Posición
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#94a3b8',
              textAlign: 'center',
              padding: '20px',
            }}
          >
            <p>Primero escanea un producto a la izquierda para habilitar la reubicación.</p>
          </div>
        )}
      </section>
    </div>
  );
}
