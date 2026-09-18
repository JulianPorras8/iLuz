import React, { useState, useEffect } from 'react';

export default function ProductModal({ isOpen, product, locations, onSave, onClose, isStockLocked }) {
  const [formData, setFormData] = useState({
    id: 0,
    barcode: '',
    name: '',
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: parseInt(formData.id, 10) || 0,
      barcode: formData.barcode.trim(),
      name: formData.name.trim(),
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
                  placeholder="Ej: Café Juan Valdez 500g"
                  autoFocus
                />
              </div>
            </div>

            <div className="grid-3">
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
                {isStockLocked && (
                  <small style={{ color: '#b45309', fontSize: '11px', display: 'block', marginTop: '3px' }}>
                    🔒 Bloqueado: Toma de inventario activa. El stock se ajustará al finalizar la toma.
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>Unidad de Medida:</label>
                <select
                  value={formData.unitOfMeasure}
                  onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                >
                  <option value="und">und (Unidad)</option>
                  <option value="kg">kg (Kilogramo)</option>
                  <option value="g">g (Gramo)</option>
                  <option value="l">l (Litro)</option>
                  <option value="ml">ml (Mililitro)</option>
                  <option value="lb">lb (Libra)</option>
                  <option value="paquete">paquete</option>
                  <option value="caja">caja</option>
                  <option value="metro">metro</option>
                </select>
              </div>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label>Peso (kg/lb):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Tamaño / Medida:</label>
                <input
                  type="text"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="Ej: Grande, 500ml, 30x20cm"
                />
              </div>
              <div className="form-group">
                <label>Color:</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Ej: Rojo, Azul, Blanco"
                />
              </div>
            </div>

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

            <div className="form-group" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="prod-active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                style={{ width: 'auto' }}
              />
              <label htmlFor="prod-active" style={{ margin: 0, cursor: 'pointer' }}>
                Producto activo (disponible en punto de venta)
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
