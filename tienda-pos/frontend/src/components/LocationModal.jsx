import React, { useState, useEffect } from 'react';

export default function LocationModal({ isOpen, location, onSave, onClose }) {
  const [formData, setFormData] = useState({
    id: 0,
    code: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    if (location) {
      setFormData({
        id: location.id || 0,
        code: location.code || '',
        name: location.name || '',
        description: location.description || '',
      });
    } else {
      setFormData({
        id: 0,
        code: '',
        name: '',
        description: '',
      });
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, location, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: parseInt(formData.id, 10) || 0,
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      description: formData.description.trim(),
    });
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ width: '480px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px' }}>
            {formData.id > 0 ? 'Editar Locación' : 'Nueva Locación'}
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
            <div className="form-group">
              <label>Código de Locación (*):</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ej: PAS-01, EST-B2, BODEGA-A"
                style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Nombre de la Locación (*):</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Pasillo 1 - Lácteos y Huevos"
              />
            </div>
            <div className="form-group">
              <label>Descripción / Observaciones:</label>
              <textarea
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles de acceso, altura o tipo de mercancía"
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-clear" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Guardar Locación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
