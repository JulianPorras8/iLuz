import React, { useState } from 'react';

export default function LocationsView({
  locations = [],
  shelves = [],
  onOpenNewShelf,
  onEditShelf,
  onRequestDeleteShelf,
  onOpenNewLocation,
  onEditLocation,
  onRequestDeleteLocation,
}) {
  const [activeTab, setActiveTab] = useState('shelves'); // 'shelves' or 'all'
  const [searchFilter, setSearchFilter] = useState('');

  // Filter individual locations
  const filteredLocations = locations.filter((loc) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      loc.code.toLowerCase().includes(q) ||
      loc.name.toLowerCase().includes(q) ||
      (loc.description && loc.description.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div className="toolbar" style={{ borderBottom: '1px solid #e2e8f0', background: '#fff', padding: '12px 18px' }}>
        <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', margin: 0, color: '#0f172a' }}>
              Catálogo de Estantes, Niveles y Locaciones
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Organización física de bodega y piso de venta
            </span>
          </div>

          {/* Sub-tabs Toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setActiveTab('shelves')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'shelves' ? '#fff' : 'transparent',
                color: activeTab === 'shelves' ? '#2563eb' : '#64748b',
                boxShadow: activeTab === 'shelves' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              🗄️ Estantes Estructurados ({shelves.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'all' ? '#fff' : 'transparent',
                color: activeTab === 'all' ? '#2563eb' : '#64748b',
                boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              🏷️ Todas las Posiciones ({locations.length})
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenNewLocation}
            title="Crear una posición simple o zona sin estantería"
            style={{ fontSize: '13px' }}
          >
            ➕ Locación Simple / Zona
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenNewShelf}
            title="Crear estantería asistida con niveles y casillas automáticas"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🗄️ Nuevo Estante Asistido
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc' }}>
        
        {/* TAB 1: STRUCTURED SHELVES VIEW */}
        {activeTab === 'shelves' && (
          <div>
            {shelves.length === 0 ? (
              <div
                style={{
                  background: '#fff',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  maxWidth: '600px',
                  margin: '40px auto',
                }}
              >
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>🗄️</div>
                <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '8px' }}>
                  No tienes estantes estructurados todavía
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
                  Crea tu primera estantería con niveles asimétricos (ej. Nivel 1 con 3 casillas, Nivel 2 con 2 casillas). 
                  El sistema generará automáticamente todas las posiciones y códigos de barras correspondientes.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onOpenNewShelf}
                  style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 600 }}
                >
                  ➕ Crear Estante Asistido
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {shelves.map((sh) => {
                  let levels = sh.levels || [];
                  if (levels.length === 0 && sh.levelsJson) {
                    try {
                      levels = JSON.parse(sh.levelsJson);
                    } catch (e) {
                      levels = [];
                    }
                  }
                  // Render top to bottom
                  const displayLevels = [...levels].sort((a, b) => b.level - a.level);
                  const totalSlots = levels.reduce((acc, l) => acc + (l.slots || 1), 0);

                  return (
                    <div
                      key={sh.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Shelf Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                fontSize: '13px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: '1px solid #bfdbfe',
                              }}
                            >
                              {sh.code}
                            </span>
                            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '6px 0 2px 0', color: '#0f172a' }}>
                              {sh.name}
                            </h4>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                              {sh.description || 'Sin descripción adicional'}
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-clear"
                              onClick={() => onEditShelf(sh)}
                              title="Editar Estante y Niveles"
                              style={{ padding: '6px 8px' }}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-clear"
                              onClick={() => onRequestDeleteShelf(sh)}
                              title="Eliminar Estante"
                              style={{ padding: '6px 8px', color: '#ef4444' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Shelf Summary Badges */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                          <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            📏 {levels.length} {levels.length === 1 ? 'Nivel' : 'Niveles'}
                          </span>
                          <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            📦 {totalSlots} {totalSlots === 1 ? 'Casilla' : 'Casillas'}
                          </span>
                        </div>

                        {/* Mini Visual Diagram of the Shelf */}
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '2px solid #475569',
                            borderRadius: '6px',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          {displayLevels.map((lvl) => (
                            <div key={lvl.level}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>
                                <span style={{ fontWeight: 600 }}>N{lvl.level}</span>
                                <span>{lvl.slots} casillas</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lvl.slots}, 1fr)`, gap: '4px' }}>
                                {Array.from({ length: lvl.slots }).map((_, slotIdx) => (
                                  <div
                                    key={slotIdx}
                                    style={{
                                      background: '#fff',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      padding: '4px 2px',
                                      textAlign: 'center',
                                      fontSize: '9px',
                                      fontFamily: 'monospace',
                                      color: '#2563eb',
                                      fontWeight: 600,
                                    }}
                                  >
                                    C{slotIdx + 1}
                                  </div>
                                ))}
                              </div>
                              <div style={{ height: '3px', background: '#64748b', borderRadius: '1px', marginTop: '4px' }} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Formato: <code>{sh.code}-N[L]-C[S]</code>
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => onEditShelf(sh)}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          Ajustar Niveles
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FLAT LIST OF ALL POSITIONS */}
        {activeTab === 'all' && (
          <div className="panel" style={{ padding: 0, background: '#fff', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Search filter in table */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="🔍 Filtrar por código, nombre o estante..."
                style={{ width: '320px', padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                Mostrando {filteredLocations.length} de {locations.length} posiciones
              </span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>CÓDIGO DE POSICIÓN</th>
                    <th style={{ width: '280px' }}>NOMBRE / DESCRIPCIÓN</th>
                    <th>DETALLE</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocations.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                        No se encontraron posiciones con ese criterio.
                      </td>
                    </tr>
                  ) : (
                    filteredLocations.map((loc) => (
                      <tr key={loc.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                          {loc.code}
                        </td>
                        <td style={{ fontWeight: 600 }}>{loc.name}</td>
                        <td style={{ color: '#64748b', fontSize: '12px' }}>{loc.description || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-clear"
                            onClick={() => onEditLocation(loc)}
                            title="Editar Posición"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-clear"
                            onClick={() => onRequestDeleteLocation(loc)}
                            title="Eliminar Posición"
                            style={{ color: '#ef4444', marginLeft: '4px' }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
