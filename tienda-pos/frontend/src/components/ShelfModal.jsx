import React, { useState, useEffect } from 'react';

export default function ShelfModal({ isOpen, shelf, onSave, onClose }) {
  const [formData, setFormData] = useState({
    id: 0,
    code: '',
    name: '',
    description: '',
    levels: [
      { level: 3, name: 'Nivel 3', slots: 1 },
      { level: 2, name: 'Nivel 2', slots: 2 },
      { level: 1, name: 'Nivel 1', slots: 3 },
    ],
  });

  useEffect(() => {
    if (!isOpen) return;

    if (shelf) {
      let levels = [];
      if (shelf.levels && shelf.levels.length > 0) {
        levels = [...shelf.levels].sort((a, b) => b.level - a.level);
      } else if (shelf.levelsJson) {
        try {
          const parsed = JSON.parse(shelf.levelsJson);
          levels = parsed.sort((a, b) => b.level - a.level);
        } catch (e) {
          levels = [];
        }
      }
      if (levels.length === 0) {
        levels = [
          { level: 3, name: 'Nivel 3', slots: 1 },
          { level: 2, name: 'Nivel 2', slots: 2 },
          { level: 1, name: 'Nivel 1', slots: 3 },
        ];
      }
      setFormData({
        id: shelf.id || 0,
        code: shelf.code || '',
        name: shelf.name || '',
        description: shelf.description || '',
        levels,
      });
    } else {
      setFormData({
        id: 0,
        code: '',
        name: '',
        description: '',
        levels: [
          { level: 3, name: 'Nivel 3', slots: 1 },
          { level: 2, name: 'Nivel 2', slots: 2 },
          { level: 1, name: 'Nivel 1', slots: 3 },
        ],
      });
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, shelf, onClose]);

  if (!isOpen) return null;

  // Level operations
  const handleAddTopLevel = () => {
    const currentMax = formData.levels.length > 0 
      ? Math.max(...formData.levels.map((l) => l.level))
      : 0;
    const nextLevel = currentMax + 1;
    const newLevels = [
      { level: nextLevel, name: `Nivel ${nextLevel}`, slots: 1 },
      ...formData.levels,
    ];
    setFormData({ ...formData, levels: newLevels });
  };

  const handleRemoveTopLevel = (levelNum) => {
    if (formData.levels.length <= 1) return;
    const filtered = formData.levels.filter((l) => l.level !== levelNum);
    // Re-index remaining levels so they remain 1..N
    const sortedAsc = [...filtered].sort((a, b) => a.level - b.level);
    const reindexed = sortedAsc.map((l, idx) => ({
      ...l,
      level: idx + 1,
      name: `Nivel ${idx + 1}`,
    })).sort((a, b) => b.level - a.level);
    setFormData({ ...formData, levels: reindexed });
  };

  const handleUpdateSlots = (levelNum, delta) => {
    const updated = formData.levels.map((l) => {
      if (l.level === levelNum) {
        const nextSlots = Math.max(1, Math.min(12, l.slots + delta));
        return { ...l, slots: nextSlots };
      }
      return l;
    });
    setFormData({ ...formData, levels: updated });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) return;

    // Convert levels to ascending order [Level 1, Level 2, ...] for backend storage
    const sortedForStorage = [...formData.levels].sort((a, b) => a.level - b.level);

    onSave({
      id: parseInt(formData.id, 10) || 0,
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      levels: sortedForStorage,
    });
  };

  const totalCasillas = formData.levels.reduce((acc, l) => acc + l.slots, 0);
  const baseCode = formData.code.trim().toUpperCase() || 'EST-01';

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ width: '840px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🗄️</span>
            <h3 style={{ fontSize: '16px', margin: 0 }}>
              {formData.id > 0 ? 'Editar Estantería Estructurada' : 'Nueva Estantería Asistida'}
            </h3>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '24px' }}>
              
              {/* Left Column: Form & Levels */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Código del Estante (*):
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="Ej: EST-01"
                      style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 700 }}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Nombre del Estante (*):
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Estante Frontal Tornillería"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Descripción / Ubicación Física:
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ej: Pasillo 1 - Lado izquierdo frente a mostrador"
                  />
                </div>

                {/* Levels Config Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                      Niveles y Casillas
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                      ({formData.levels.length} niveles · {totalCasillas} casillas)
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={handleAddTopLevel}
                    style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Agregar un nuevo nivel en la parte superior"
                  >
                    ➕ Agregar Nivel Superior
                  </button>
                </div>

                {/* Levels List (Top to Bottom order) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formData.levels.map((lvl, index) => {
                    const isTopLevel = index === 0 && formData.levels.length > 1;
                    return (
                      <div
                        key={lvl.level}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontWeight: 700,
                              fontSize: '12px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              minWidth: '60px',
                              textAlign: 'center',
                            }}
                          >
                            Nivel {lvl.level}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {lvl.level === 1 ? '(Inferior / Suelo)' : index === 0 ? '(Superior)' : '(Intermedio)'}
                          </span>
                        </div>

                        {/* Slots Counter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                            Casillas:
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateSlots(lvl.level, -1)}
                              disabled={lvl.slots <= 1}
                              style={{
                                width: '28px',
                                height: '28px',
                                border: 'none',
                                background: '#f1f5f9',
                                cursor: lvl.slots <= 1 ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '14px',
                                color: '#475569',
                              }}
                            >
                              -
                            </button>
                            <span style={{ width: '32px', textAlign: 'center', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                              {lvl.slots}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateSlots(lvl.level, 1)}
                              disabled={lvl.slots >= 12}
                              style={{
                                width: '28px',
                                height: '28px',
                                border: 'none',
                                background: '#f1f5f9',
                                cursor: lvl.slots >= 12 ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '14px',
                                color: '#475569',
                              }}
                            >
                              +
                            </button>
                          </div>

                          {isTopLevel && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTopLevel(lvl.level)}
                              title="Eliminar nivel superior"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '14px',
                                cursor: 'pointer',
                                padding: '4px',
                                marginLeft: '4px',
                              }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px', lineHeight: 1.4 }}>
                  💡 <strong>Convención de códigos:</strong> Al guardar se registrarán automáticamente todas las casillas bajo el formato <code>{baseCode}-N[Nivel]-C[Casilla]</code> (ej: <code>{baseCode}-N1-C1</code>).
                </p>
              </div>

              {/* Right Column: Live Visual Preview */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    📐 Previsualización en Vivo
                  </span>
                  <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Vista Frontal Real
                  </span>
                </div>

                {/* Simulated Physical Shelf Rack */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '3px solid #334155',
                    borderRadius: '8px',
                    padding: '12px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '280px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12px', color: '#475569', paddingBottom: '6px', borderBottom: '1px dashed #cbd5e1', marginBottom: '8px' }}>
                    {formData.name.trim() || 'Estantería'} ({baseCode})
                  </div>

                  {/* Render Levels Top to Bottom */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'space-around' }}>
                    {formData.levels.map((lvl) => (
                      <div key={lvl.level} style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Shelf Level Header / Label */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '3px' }}>
                          <span>Nivel {lvl.level}</span>
                          <span>{lvl.slots} {lvl.slots === 1 ? 'casilla' : 'casillas'}</span>
                        </div>

                        {/* Slots Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${lvl.slots}, 1fr)`,
                            gap: '6px',
                          }}
                        >
                          {Array.from({ length: lvl.slots }).map((_, slotIdx) => {
                            const slotNum = slotIdx + 1;
                            const slotCode = `${baseCode}-N${lvl.level}-C${slotNum}`;
                            return (
                              <div
                                key={slotNum}
                                style={{
                                  background: '#fff',
                                  border: '1.5px solid #94a3b8',
                                  borderRadius: '6px',
                                  padding: '8px 4px',
                                  textAlign: 'center',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', fontFamily: 'monospace' }}>
                                  C{slotNum}
                                </span>
                                <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                                  {slotCode}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Shelf Beam / Horizontal Plank */}
                        <div
                          style={{
                            height: '6px',
                            background: 'linear-gradient(180deg, #64748b 0%, #475569 100%)',
                            borderRadius: '2px',
                            marginTop: '6px',
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Floor Legs / Base */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginTop: '4px' }}>
                    <div style={{ width: '14px', height: '10px', background: '#334155', borderRadius: '0 0 4px 4px' }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>Piso / Suelo</span>
                    <div style={{ width: '14px', height: '10px', background: '#334155', borderRadius: '0 0 4px 4px' }} />
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '12px 24px', background: '#f8fafc' }}>
            <button type="button" className="btn btn-clear" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              💾 Guardar Estante y Generar Posiciones
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
