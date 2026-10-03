import React, { useState, useEffect } from 'react';

export default function StartAuditModal({ isOpen, locations, shelves, onStart, onClose }) {
  const [name, setName] = useState('');
  const [responsible, setResponsible] = useState('');
  const [scopeType, setScopeType] = useState('ALL');
  const [selectedShelves, setSelectedShelves] = useState([]);
  const [notes, setNotes] = useState('');

  const availableShelves = (shelves && shelves.length > 0)
    ? shelves
    : Array.from(new Set((locations || []).map(l => l.code.split('-')[0]))).filter(Boolean).map(code => ({ code, name: `Estantería ${code}` }));

  useEffect(() => {
    if (!isOpen) return;

    const today = new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    setName(`Toma de Inventario - ${today}`);
    setResponsible('');
    setScopeType('ALL');
    setSelectedShelves([]);
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

    if (scopeType === 'SHELVES' && selectedShelves.length === 0) {
      alert('Por favor, selecciona al menos una estantería.');
      return;
    }

    const finalScope = scopeType === 'ALL' ? 'ALL' : selectedShelves.join(',');

    onStart({
      name: name.trim(),
      responsible: responsible.trim(),
      scope: finalScope,
      notes: notes.trim(),
    });
  };

  const toggleShelf = (code) => {
    setSelectedShelves(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
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
                value={scopeType}
                onChange={(e) => {
                  setScopeType(e.target.value);
                  if (e.target.value === 'ALL') setSelectedShelves([]);
                }}
              >
                <option value="ALL">🏢 Toda la Tienda (Todos los productos activos)</option>
                <option value="SHELVES">🗄️ Por Estantería(s) Específica(s)</option>
              </select>

              {scopeType === 'SHELVES' && (
                <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {availableShelves.map((shelf) => (
                    <label key={shelf.code} style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedShelves.includes(shelf.code)}
                        onChange={() => toggleShelf(shelf.code)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '13px', color: '#334155' }}>
                        {shelf.code} {shelf.name ? `- ${shelf.name}` : ''}
                      </span>
                    </label>
                  ))}
                  {availableShelves.length === 0 && (
                    <span style={{ fontSize: '12px', color: '#64748b' }}>No hay estanterías disponibles.</span>
                  )}
                </div>
              )}
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
