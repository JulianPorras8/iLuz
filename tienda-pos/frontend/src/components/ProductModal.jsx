import React, { useState, useEffect, useRef, useMemo } from 'react';

function getMeasurementConfig(unit) {
  switch (unit) {
    case 'g':
      return {
        label: 'Contenido en Gramos (g):',
        placeholder: 'Ej: 100, 250, 500',
        step: 'any',
        helper: 'Digita la cantidad exacta en gramos (ej: 100)',
      };
    case 'kg':
      return {
        label: 'Peso en Kilogramos (kg):',
        placeholder: 'Ej: 1.5, 2.0',
        step: '0.01',
        helper: 'Digita el peso en kilogramos (ej: 1.5)',
      };
    case 'lb':
      return {
        label: 'Peso en Libras (lb):',
        placeholder: 'Ej: 1.0, 2.5',
        step: '0.01',
        helper: 'Digita el peso en libras (ej: 1.0)',
      };
    case 'ml':
      return {
        label: 'Volumen en Mililitros (ml):',
        placeholder: 'Ej: 250, 500, 1000',
        step: 'any',
        helper: 'Digita el volumen en mililitros (ej: 500)',
      };
    case 'l':
      return {
        label: 'Volumen en Litros (l):',
        placeholder: 'Ej: 1.0, 1.5, 2.0',
        step: '0.01',
        helper: 'Digita el volumen en litros (ej: 1.5)',
      };
    case 'metro':
      return {
        label: 'Longitud en Metros (m):',
        placeholder: 'Ej: 2.5, 5.0',
        step: '0.01',
        helper: 'Digita la longitud en metros (ej: 2.5)',
      };
    case 'paquete':
    case 'caja':
      return {
        label: `Unidades por ${unit}:`,
        placeholder: 'Ej: 6, 12, 24',
        step: '1',
        helper: `Cantidad de piezas dentro del ${unit}`,
      };
    default:
      return {
        label: 'Peso / Contenido (Opcional):',
        placeholder: 'Ej: 1',
        step: 'any',
        helper: 'Cantidad o peso unitario del producto',
      };
  }
}

export default function ProductModal({ isOpen, product, locations = [], onSave, onClose, isStockLocked }) {
  const [formData, setFormData] = useState({
    id: 0,
    barcode: '',
    name: '',
    costPrice: '',
    price: '',
    stock: 0,
    unitOfMeasure: 'und',
    weight: '',
    size: '',
    color: '',
    location: '',
    active: true,
    isQuickAccess: false,
  });

  const [locationSearch, setLocationSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lastLocation, setLastLocation] = useState('');
  const comboboxRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    try {
      const savedLast = localStorage.getItem('iLuz_last_product_location') || '';
      setLastLocation(savedLast);
    } catch (err) {}

    if (product) {
      const loc = product.location || '';
      setLocationSearch(loc);
      setFormData({
        id: product.id || 0,
        barcode: product.barcode || '',
        name: product.name || '',
        costPrice: product.costPrice !== undefined && product.costPrice !== null && product.costPrice > 0 ? product.costPrice : '',
        price: product.price ?? '',
        stock: product.stock ?? 0,
        unitOfMeasure: product.unitOfMeasure || 'und',
        weight: product.weight || '',
        size: product.size || '',
        color: product.color || '',
        location: loc,
        active: product.active ?? true,
        isQuickAccess: product.isQuickAccess || false,
      });
    } else {
      setLocationSearch('');
      setFormData({
        id: 0,
        barcode: '',
        name: '',
        costPrice: '',
        price: '',
        stock: 0,
        unitOfMeasure: 'und',
        weight: '',
        size: '',
        color: '',
        location: '',
        active: true,
        isQuickAccess: false,
      });
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, product, onClose]);

  // Click outside to close combobox dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unique shelf prefixes (e.g. EST01, EST02)
  const uniqueShelves = useMemo(() => {
    const list = [];
    const seen = new Set();
    (locations || []).forEach((loc) => {
      if (loc.code && loc.code.includes('-')) {
        const prefix = loc.code.split('-')[0];
        if (!seen.has(prefix)) {
          seen.add(prefix);
          list.push(prefix);
        }
      }
    });
    return list;
  }, [locations]);

  // Filtered locations for typeahead
  const filteredLocations = useMemo(() => {
    const term = (locationSearch || '').trim().toLowerCase();
    const all = locations || [];
    if (!term) {
      return all.slice(0, 15);
    }
    return all
      .filter((loc) => {
        const code = (loc.code || '').toLowerCase();
        const name = (loc.name || '').toLowerCase();
        return code.includes(term) || name.includes(term);
      })
      .slice(0, 20);
  }, [locations, locationSearch]);

  const handleSelectLocation = (loc) => {
    setFormData((prev) => ({ ...prev, location: loc.code }));
    setLocationSearch(loc.code);
    setIsDropdownOpen(false);
  };

  const handleLocationInputChange = (e) => {
    const val = e.target.value;
    setLocationSearch(val);
    setFormData((prev) => ({ ...prev, location: val }));
    setIsDropdownOpen(true);
  };

  const handleClearLocation = () => {
    setFormData((prev) => ({ ...prev, location: '' }));
    setLocationSearch('');
    setIsDropdownOpen(false);
  };

  const handleUseLastLocation = () => {
    if (!lastLocation) return;
    setFormData((prev) => ({ ...prev, location: lastLocation }));
    setLocationSearch(lastLocation);
    setIsDropdownOpen(false);
  };

  const handleShelfChipClick = (shPrefix) => {
    setLocationSearch(shPrefix);
    setFormData((prev) => ({ ...prev, location: shPrefix }));
    setIsDropdownOpen(true);
  };

  const handleZoneChipClick = (zoneName) => {
    setFormData((prev) => ({ ...prev, location: zoneName }));
    setLocationSearch(zoneName);
    setIsDropdownOpen(false);
  };

  if (!isOpen) return null;

  const costNum = parseFloat(formData.costPrice);
  const priceNum = parseFloat(formData.price);
  const hasMargin = !isNaN(costNum) && costNum > 0 && !isNaN(priceNum) && priceNum > 0;
  const profit = hasMargin ? priceNum - costNum : null;
  const marginPct = hasMargin && priceNum > 0 ? Math.round(((priceNum - costNum) / priceNum) * 100) : null;

  const measureConfig = getMeasurementConfig(formData.unitOfMeasure);

  const handleSubmit = (e) => {
    e.preventDefault();
    const locTrimmed = (formData.location || '').trim();
    if (locTrimmed) {
      try {
        localStorage.setItem('iLuz_last_product_location', locTrimmed);
      } catch (err) {}
    }
    onSave({
      id: parseInt(formData.id, 10) || 0,
      barcode: formData.barcode.trim(),
      name: formData.name.trim(),
      costPrice: parseFloat(formData.costPrice) || 0,
      price: parseFloat(formData.price) || 0,
      stock: parseInt(formData.stock, 10) || 0,
      unitOfMeasure: formData.unitOfMeasure,
      weight: parseFloat(formData.weight) || 0,
      size: formData.size.trim(),
      color: formData.color.trim(),
      location: locTrimmed,
      active: Boolean(formData.active),
      isQuickAccess: Boolean(formData.isQuickAccess),
    });
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <h3 style={{ fontSize: '16px' }}>
            {formData.id > 0 ? 'Editar Producto' : 'Nuevo Producto'}
          </h3>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Row 1: Identification */}
            <div className="grid-2">
              <div className="form-group">
                <label htmlFor="prod-barcode">Código de Barras (Opcional):</label>
                <input
                  id="prod-barcode"
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Dejar vacío para generar INT-XXXXXX"
                  style={{ fontFamily: 'monospace' }}
                />
                <small style={{ color: '#64748b', fontSize: '11px' }}>
                  Si no tiene código físico, se autogenerará uno interno.
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="prod-name">Nombre del Producto (*):</label>
                <input
                  id="prod-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Café Molido 100g, Arroz 1kg"
                  autoFocus
                />
              </div>
            </div>

            {/* Row 2: Economics & Stock */}
            <div className="grid-3">
              <div className="form-group">
                <label htmlFor="prod-cost">Precio de Costo ($):</label>
                <input
                  id="prod-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.00"
                />
                <small style={{ color: '#64748b', fontSize: '11px' }}>
                  Costo de adquisición / compra
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="prod-price">Precio de Venta (*):</label>
                <input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
                {hasMargin ? (
                  <small style={{ color: profit >= 0 ? '#059669' : '#dc2626', fontSize: '11px', fontWeight: 600 }}>
                    Margen: {profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`} ({marginPct}%)
                  </small>
                ) : (
                  <small style={{ color: '#64748b', fontSize: '11px' }}>
                    Precio al público
                  </small>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="prod-stock">Stock Actual (*):</label>
                <input
                  id="prod-stock"
                  type="number"
                  min="0"
                  required
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  disabled={isStockLocked}
                  style={isStockLocked ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : {}}
                />
                {isStockLocked ? (
                  <small style={{ color: '#b45309', fontSize: '11px', display: 'block', marginTop: '3px' }}>
                    🔒 Bloqueado: Toma activa.
                  </small>
                ) : (
                  <small style={{ color: '#64748b', fontSize: '11px' }}>
                    Existencias iniciales
                  </small>
                )}
              </div>
            </div>

            {/* Row 3: Measurement & Dynamic Content Input */}
            <div className="grid-2">
              <div className="form-group">
                <label>Unidad de Medida:</label>
                <select
                  value={formData.unitOfMeasure}
                  onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                >
                  <option value="und">und (Unidad)</option>
                  <option value="g">g (Gramos)</option>
                  <option value="kg">kg (Kilogramos)</option>
                  <option value="lb">lb (Libras)</option>
                  <option value="ml">ml (Mililitros)</option>
                  <option value="l">l (Litros)</option>
                  <option value="paquete">paquete (Paquete)</option>
                  <option value="caja">caja (Caja)</option>
                  <option value="metro">metro (Metros)</option>
                </select>
                <small style={{ color: '#64748b', fontSize: '11px' }}>
                  Determina la magnitud de conteo y venta
                </small>
              </div>

              <div className="form-group">
                <label>{measureConfig.label}</label>
                <input
                  type="number"
                  step={measureConfig.step}
                  min="0"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder={measureConfig.placeholder}
                />
                <small style={{ color: '#64748b', fontSize: '11px' }}>
                  {measureConfig.helper}
                </small>
              </div>
            </div>

            {/* Row 4: Optional Attributes */}
            <div className="grid-2">
              <div className="form-group">
                <label>Tamaño / Presentación:</label>
                <input
                  type="text"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="Ej: Grande, Familiar, 30x20cm, Sobre"
                />
              </div>
              <div className="form-group">
                <label>Color / Variante:</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Ej: Rojo, Azul, Blanco, Sabor Fresa"
                />
              </div>
            </div>

            {/* Row 5: Physical Location Combobox & Quick Presets */}
            <div className="form-group" ref={comboboxRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>
                  📍 Ubicación / Posición Física:
                </label>
                {lastLocation && lastLocation !== formData.location && (
                  <button
                    type="button"
                    onClick={handleUseLastLocation}
                    className="btn btn-sm"
                    title={`Usar última ubicación guardada: ${lastLocation}`}
                    style={{
                      background: '#ecfdf5',
                      color: '#065f46',
                      border: '1px solid #a7f3d0',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>⚡ Usar última:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{lastLocation}</strong>
                  </button>
                )}
              </div>

              {/* Combobox Input with Clear button */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={locationSearch}
                  onChange={handleLocationInputChange}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Escribe para buscar (ej: EST01, Nivel 1) o digita libre..."
                  style={{
                    width: '100%',
                    padding: '8px 30px 8px 10px',
                    fontSize: '13px',
                    fontFamily: locationSearch && locationSearch.includes('-') ? 'monospace' : 'inherit',
                    borderRadius: '6px',
                    border: isDropdownOpen ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                    background: formData.location ? '#f8fafc' : 'white',
                  }}
                />
                {locationSearch && (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    title="Limpiar ubicación"
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '2px 4px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Filter / Shortcut Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Accesos rápidos:</span>
                {['Mostrador', 'Nevera', 'Bodega'].map((zone) => (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => handleZoneChipClick(zone)}
                    style={{
                      border: '1px solid #e2e8f0',
                      background: formData.location === zone ? '#eff6ff' : '#f8fafc',
                      color: formData.location === zone ? '#1d4ed8' : '#475569',
                      fontWeight: formData.location === zone ? 700 : 500,
                      borderRadius: '12px',
                      fontSize: '11px',
                      padding: '1px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {zone}
                  </button>
                ))}
                {uniqueShelves.slice(0, 4).map((shPrefix) => (
                  <button
                    key={shPrefix}
                    type="button"
                    onClick={() => handleShelfChipClick(shPrefix)}
                    style={{
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#0f766e',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      borderRadius: '12px',
                      fontSize: '11px',
                      padding: '1px 8px',
                      cursor: 'pointer',
                    }}
                    title={`Filtrar por estante ${shPrefix}`}
                  >
                    🔍 {shPrefix}
                  </button>
                ))}
              </div>

              {/* Autocomplete Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 60,
                    maxHeight: '210px',
                    overflowY: 'auto',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
                    marginTop: '2px',
                  }}
                >
                  {filteredLocations.length > 0 ? (
                    filteredLocations.map((loc) => {
                      const isSelected = formData.location === loc.code;
                      return (
                        <div
                          key={loc.id || loc.code}
                          onClick={() => handleSelectLocation(loc)}
                          style={{
                            padding: '7px 10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            background: isSelected ? '#eff6ff' : 'white',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '12px',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'white';
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                color: '#1e40af',
                                background: '#eff6ff',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginRight: '8px',
                              }}
                            >
                              {loc.code}
                            </span>
                            <span style={{ color: '#334155' }}>{loc.name}</span>
                          </div>
                          {isSelected && (
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '10px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                      No se encontraron casillas con "{locationSearch}". Se guardará como ubicación libre.
                    </div>
                  )}
                  {locations && locations.length > filteredLocations.length && (
                    <div
                      style={{
                        padding: '4px 10px',
                        background: '#f8fafc',
                        fontSize: '10px',
                        color: '#94a3b8',
                        textAlign: 'right',
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      Mostrando {filteredLocations.length} de {locations.length} ubicaciones
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Row 6: Active Status & Quick Access */}
            <div className="grid-2" style={{ marginTop: '10px' }}>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="prod-active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="prod-active" style={{ margin: 0, cursor: 'pointer' }}>
                  Producto activo
                </label>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="prod-quick-access"
                  checked={formData.isQuickAccess}
                  onChange={(e) => setFormData({ ...formData, isQuickAccess: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="prod-quick-access" style={{ margin: 0, cursor: 'pointer' }}>
                  ☑ Producto de acceso rápido (Mostrar botón directo en Caja)
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-clear" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Guardar Producto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
