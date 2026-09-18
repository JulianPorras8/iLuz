import React, { useState, useMemo } from 'react';

export default function InventoryView({
  products,
  onOpenNewProduct,
  onEditProduct,
  onToggleActive,
  onExportCSV,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'all', 'active', 'archived'

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (products || []).filter((p) => {
      // Status filter
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'archived' && p.active) return false;

      // Query filter
      if (!q) return true;
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery, statusFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="quick-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Filtrar por nombre, código o ubicación..."
            style={{ width: '320px', background: '#fff', color: '#0f172a', borderColor: '#cbd5e1' }}
          />

          <select
            className="port-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: '#fff', color: '#0f172a', borderColor: '#cbd5e1' }}
          >
            <option value="active">Solo activos</option>
            <option value="all">Todos los productos</option>
            <option value="archived">Solo archivados</option>
          </select>

          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            {filteredProducts.length} productos
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenNewProduct}
          >
            ➕ Nuevo Producto
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={onExportCSV}
            title="Descargar todo el inventario en formato CSV con acentos compatibles en Excel"
          >
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="panel" style={{ flex: 1, padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>CÓDIGO</th>
                <th>DESCRIPCIÓN</th>
                <th>P. COSTO</th>
                <th>P. VENTA</th>
                <th>STOCK</th>
                <th>UNIDAD</th>
                <th>CANT. / PESO</th>
                <th>TAMAÑO</th>
                <th>COLOR</th>
                <th>UBICACIÓN</th>
                <th>ESTADO</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                    No se encontraron productos con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id || p.barcode}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                      {p.barcode}
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ color: p.costPrice > 0 ? '#475569' : '#94a3b8' }}>
                      {p.costPrice > 0 ? `$${p.costPrice.toFixed(2)}` : '-'}
                    </td>
                    <td style={{ fontWeight: 600 }}>${(p.price || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>{p.stock}</td>
                    <td>
                      <span style={{ color: '#64748b' }}>{p.unitOfMeasure || 'und'}</span>
                    </td>
                    <td>{p.weight > 0 ? `${p.weight} ${p.unitOfMeasure || ''}`.trim() : '-'}</td>
                    <td>{p.size || '-'}</td>
                    <td>{p.color || '-'}</td>
                    <td>
                      {p.location ? (
                        <span style={{ color: '#059669', fontWeight: 600 }}>📍 {p.location}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          p.active ? 'status-pill-active' : 'status-pill-archived'
                        }`}
                      >
                        {p.active ? 'Activo' : 'Archivado'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-clear"
                        onClick={() => onEditProduct(p)}
                        title="Editar Producto"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-clear"
                        onClick={() => onToggleActive(p)}
                        title={p.active ? 'Archivar' : 'Reactivar'}
                        style={{ color: p.active ? '#ef4444' : '#10b981', marginLeft: '4px' }}
                      >
                        {p.active ? '📦 Archivar' : '♻️ Activar'}
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
