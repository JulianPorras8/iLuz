import React, { useState, useMemo, useRef } from 'react';

export default function InventoryView({
  products,
  onOpenNewProduct,
  onEditProduct,
  onToggleActive,
  onExportCSV,
  onImportCSV,
  onOpenBarcodeLink,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'all', 'active', 'archived'
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

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
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery, statusFilter]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      if (onImportCSV) {
        const res = await onImportCSV(text);
        setImportSummary(res);
      }
    } catch (err) {
      alert(`Error al importar catálogo: ${err.message || err}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Hidden File Input for CSV Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Top Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="quick-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Filtrar por nombre, código, categoría o ubicación..."
            style={{ width: '340px', background: '#fff', color: '#0f172a', borderColor: '#cbd5e1' }}
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
            className="btn"
            style={{
              backgroundColor: '#6366f1',
              color: '#ffffff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            disabled={isImporting}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="Importar catálogo masivo desde archivo CSV"
          >
            {isImporting ? '⏳ Importando...' : '📥 Importar Catálogo CSV'}
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

      {/* Import Summary Modal */}
      {importSummary && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setImportSummary(null)}
        >
          <div
            className="modal-container"
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '28px' }}>✅</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Catálogo Importado Exitosamente
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  El catálogo maestro fue procesado e integrado al inventario.
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Total Procesados:</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {importSummary.totalProcessed || 0}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Nuevos Insertados:</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>
                  {importSummary.inserted || 0}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Actualizados:</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>
                  {importSummary.updated || 0}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Errores:</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: (importSummary.errors?.length || 0) > 0 ? '#dc2626' : '#64748b' }}>
                  {importSummary.errors?.length || 0}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setImportSummary(null)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="panel" style={{ flex: 1, padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>CÓDIGO</th>
                <th>DESCRIPCIÓN</th>
                <th>CATEGORÍA</th>
                <th>P. COSTO</th>
                <th>P. VENTA</th>
                <th>STOCK</th>
                <th>UNIDAD</th>
                <th>UBICACIÓN</th>
                <th>ESTADO</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                    No se encontraron productos con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isInternalCode = (p.barcode || '').startsWith('ILUZ-') || (p.barcode || '').startsWith('INT-');
                  return (
                    <tr key={p.id || p.barcode}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                        {p.barcode}
                        {p.isQuickAccess && (
                          <span
                            title="Acceso Rápido en Caja"
                            style={{
                              marginLeft: '4px',
                              fontSize: '11px',
                              padding: '1px 4px',
                              borderRadius: '4px',
                              background: '#fef3c7',
                              color: '#92400e',
                            }}
                          >
                            ⚡
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        {p.category ? (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontWeight: 500,
                            }}
                          >
                            {p.category}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
                        )}
                      </td>
                      <td style={{ color: p.costPrice > 0 ? '#475569' : '#94a3b8' }}>
                        {p.costPrice > 0 ? `$${p.costPrice.toLocaleString('es-CO')}` : '-'}
                      </td>
                      <td style={{ fontWeight: 600 }}>${(p.price || 0).toLocaleString('es-CO')}</td>
                      <td style={{ fontWeight: 700, color: p.stock <= 0 ? '#ef4444' : '#0f172a' }}>
                        {p.stock}
                      </td>
                      <td>
                        <span style={{ color: '#64748b' }}>{p.unitOfMeasure || 'und'}</span>
                      </td>
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
                        {isInternalCode && onOpenBarcodeLink && (
                          <button
                            type="button"
                            className="btn btn-sm btn-clear"
                            onClick={() => onOpenBarcodeLink(p)}
                            title="Vincular código de barras físico (EAN-13)"
                            style={{ color: '#2563eb', marginRight: '4px', fontWeight: 600 }}
                          >
                            🔗 Vincular
                          </button>
                        )}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
