import React, { useState, useEffect } from 'react';

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

export default function ProductModal({ isOpen, product, locations, onSave, onClose, isStockLocked }) {
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
  });

  useEffect(() => {
    if (!isOpen) return;

    if (product) {
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
        location: product.location || '',
        active: product.active ?? true,
      });
    } else {
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
      });
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, product, onClose]);

  if (!isOpen) return null;

  const costNum = parseFloat(formData.costPrice);
  const priceNum = parseFloat(formData.price);
  const hasMargin = !isNaN(costNum) && costNum > 0 && !isNaN(priceNum) && priceNum > 0;
  const profit = hasMargin ? priceNum - costNum : null;
  const marginPct = hasMargin && priceNum > 0 ? Math.round(((priceNum - costNum) / priceNum) * 100) : null;

  const measureConfig = getMeasurementConfig(formData.unitOfMeasure);

  const handleSubmit = (e) => {
    e.preventDefault();
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
      location: formData.location.trim(),
      active: Boolean(formData.active),
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
                <label>Código de Barras (Opcional):</label>
                <input
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
                <label>Nombre del Producto (*):</label>
                <input
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
                <label>Precio de Costo ($):</label>
                <input
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
                <label>Precio de Venta (*):</label>
                <input
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
                <label>Stock Actual (*):</label>
                <input
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

            {/* Row 5: Physical Location */}
            <div className="form-group">
              <label>Ubicación / Posición Física:</label>
              <div className="grid-2">
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                >
                  <option value="">-- Seleccionar locación --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={`${loc.code} - ${loc.name}`}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="O escribir ubicación libre..."
                />
              </div>
            </div>

            {/* Row 6: Active Status */}
            <div className="form-group" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="prod-active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                style={{ width: 'auto' }}
              />
              <label htmlFor="prod-active" style={{ margin: 0, cursor: 'pointer' }}>
                Producto activo (disponible en inventario y venta)
              </label>
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
