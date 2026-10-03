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
      setFormData(supplier);
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
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown} tabIndex="0">
      <div className="modal-content">
        <h2>{supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
        <form onSubmit={handleSubmit} className="supplier-form">
          <div className="form-group">
            <label>Razón Social o Nombre Comercial *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>NIT o Cédula</label>
              <input type="text" name="nitOrCedula" value={formData.nitOrCedula} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Asesor / Vendedor</label>
              <input type="text" name="contactName" value={formData.contactName} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Teléfono o Celular</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Correo Electrónico</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Dirección o Bodega</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Ciudad / Municipio</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Plazo de Pago</label>
              <select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange}>
                <option value="Contado">Contado</option>
                <option value="Crédito 8 días">Crédito 8 días</option>
                <option value="Crédito 15 días">Crédito 15 días</option>
                <option value="Crédito 30 días">Crédito 30 días</option>
              </select>
            </div>
            <div className="form-group">
              <label>Días de Entrega (Ej. Lunes y Jueves)</label>
              <input type="text" name="deliveryDays" value={formData.deliveryDays} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>Observaciones</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2"></textarea>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input type="checkbox" name="active" checked={formData.active} onChange={handleChange} />
              Proveedor Activo
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierModal;
