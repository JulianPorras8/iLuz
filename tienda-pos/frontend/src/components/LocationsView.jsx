import React from 'react';

export default function LocationsView({
  locations,
  onOpenNewLocation,
  onEditLocation,
  onRequestDeleteLocation,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <h3 style={{ fontSize: '16px' }}>Catálogo de Pasillos, Estantes y Zonas</h3>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            {locations.length} locaciones
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenNewLocation}
        >
          ➕ Nueva Locación
        </button>
      </div>

      {/* Locations Table */}
      <div className="panel" style={{ flex: 1, padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>CÓDIGO</th>
                <th style={{ width: '250px' }}>NOMBRE</th>
                <th>DESCRIPCIÓN</th>
                <th style={{ width: '140px', textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                    No hay locaciones registradas. Crea tu primera zona con el botón de arriba.
                  </td>
                </tr>
              ) : (
                locations.map((loc) => (
                  <tr key={loc.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                      {loc.code}
                    </td>
                    <td style={{ fontWeight: 600 }}>{loc.name}</td>
                    <td style={{ color: '#64748b' }}>{loc.description || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-clear"
                        onClick={() => onEditLocation(loc)}
                        title="Editar Locación"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-clear"
                        onClick={() => onRequestDeleteLocation(loc)}
                        title="Eliminar Locación"
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
    </div>
  );
}
