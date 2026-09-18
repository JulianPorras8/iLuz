import React, { useState, useEffect } from 'react';

export default function StartAuditModal({ isOpen, locations, onStart, onClose }) {
  const [name, setName] = useState('');
  const [responsible, setResponsible] = useState('');
  const [scope, setScope] = useState('ALL');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Suggest a default name with current date
    const today = new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    setName(`Toma de Inventario - ${today}`);
    setResponsible('');
    setScope('ALL');
    setNotes('');

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onStart({
      name: name.trim(),
      responsible: responsible.trim(),
      scope,
      notes: notes.trim(),
    });
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ width: '520px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px' }}>📋 Iniciar Nueva Toma de Inventario</h3>
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
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#1e40af',
                marginBottom: '16px',
                lineHeight: 1.4,
              }}
            >
              ℹ️ Al iniciar, el sistema capturará automáticamente un <strong>snapshot</strong> con las
              existencias actuales para calcular diferencias a medida que vayas contando. Podrás
              pausar y continuar durante varios días.
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Nombre del Inventario *
              </label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Inventario General 2026"
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Responsable / Operador
              </label>
              <input
                type="text"
                className="form-control"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Nombre de quien realiza el conteo"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Alcance / Zona a Contar *
              </label>
              <select
                className="form-control"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="ALL">🏢 Toda la Tienda (Todos los productos activos)</option>
                {locations && locations.map((loc) => (
                  <option key={loc.id} value={loc.code}>
                    📍 Zona: {loc.code} - {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Notas / Objetivos
              </label>
              <textarea
                className="form-control"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles u observaciones opcionales..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              🚀 Iniciar Inventario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
