import React, { useState, useEffect } from 'react';

const SupplierModal = ({ isOpen, supplier, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    nitOrCedula: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    paymentTerms: 'Contado',
    deliveryDays: '',
    notes: '',
    active: true,
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        ...supplier,
        active: supplier.active !== undefined ? Boolean(supplier.active) : true,
      });
    } else {
      setFormData({
        name: '',
        nitOrCedula: '',
        contactName: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        paymentTerms: 'Contado',
        deliveryDays: '',
        notes: '',
        active: true,
      });
    }
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      tabIndex="0"
    >
      <div className="modal-card" style={{ width: '640px', maxWidth: '95vw', maxHeight: '90vh' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🚚</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                {supplier?.id ? 'Editar Proveedor' : 'Nuevo Proveedor o Distribuidor'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                {supplier?.id ? `Actualizando ficha de: ${supplier.name}` : 'Registra un distribuidor para entrada de pedidos'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#64748b', cursor: 'pointer' }}
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Sección: Identificación Comercial */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🏢 Datos de la Empresa
              </div>
              <div className="grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Razón Social / Nombre Comercial <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ej: Distribuidora La 14, Postobón S.A."
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>NIT o Cédula</label>
                  <input
                    type="text"
                    name="nitOrCedula"
                    value={formData.nitOrCedula}
                    onChange={handleChange}
                    placeholder="Ej: 900.123.456-7"
                  />
                </div>
              </div>
            </div>

            {/* Sección: Contacto */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                👤 Asesor & Comunicación
              </div>
              <div className="grid-3">
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Asesor / Preventista</label>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="Ej: Carlos Gómez"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Ej: 3101234567"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Correo Electrónico</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="pedidos@distribuidor.com"
                  />
                </div>
              </div>
            </div>

            {/* Sección: Logística y Condiciones */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📦 Logística y Términos Comerciales
              </div>
              <div className="grid-2" style={{ marginBottom: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Condición de Pago</label>
                  <select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange}>
                    <option value="Contado">💵 Contado / Contraentrega</option>
                    <option value="Crédito 8 días">⏱️ Crédito 8 días</option>
                    <option value="Crédito 15 días">⏱️ Crédito 15 días</option>
                    <option value="Crédito 30 días">⏱️ Crédito 30 días</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Días de Entrega</label>
                  <input
                    type="text"
                    name="deliveryDays"
                    value={formData.deliveryDays}
                    onChange={handleChange}
                    placeholder="Ej: Martes y Viernes (mañana)"
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Dirección o Bodega</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Ej: Calle 45 # 12-34"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Ciudad / Municipio</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Ej: Bogotá, Medellín"
                  />
                </div>
              </div>
            </div>

            {/* Notas y Estado */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Observaciones o Acuerdos Especiales</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="2"
                placeholder="Ej: Pedido mínimo $150.000 para flete gratis. Descuento del 3% por pronto pago."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              ></textarea>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="supplier-active"
                name="active"
                checked={formData.active}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="supplier-active" style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', cursor: 'pointer', margin: 0 }}>
                Proveedor Activo (disponible para registrar compras y pedidos)
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontWeight: 700 }}>
              💾 Guardar Proveedor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierModal;
