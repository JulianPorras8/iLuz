import React, { useState, useEffect, useRef } from 'react';

export default function AuditReconciliationModal({
  isOpen,
  session,
  items,
  onConfirmClose,
  onExportCSV,
  onClose,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterMode, setFilterMode] = useState('differences'); // 'all', 'differences', 'counted'
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    // Initialize selection only once upon modal open, preventing mid-count resets
    if (!prevIsOpenRef.current && items) {
      prevIsOpenRef.current = true;
      const initialSelected = new Set();
      items.forEach((it) => {
        if (it.isCounted && it.variance !== 0) {
          initialSelected.add(it.productId);
        }
      });
      setSelectedIds(initialSelected);
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, onClose]);

  if (!isOpen || !session) return null;

  // Counts & metrics
  const totalItems = items.length;
  const countedItems = items.filter((it) => it.isCounted).length;
  const uncountedItems = totalItems - countedItems;
  const differenceItems = items.filter((it) => it.isCounted && it.variance !== 0).length;

  const totalFinancialImpact = items.reduce((acc, it) => {
    if (it.isCounted) {
      return acc + it.difference;
    }
    return acc;
  }, 0);

  // Selection handlers
  const handleToggleItem = (productId, isCounted) => {
    if (!isCounted) return; // Uncounted cannot be selected (Rule 4 guardrail)
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectDifferencesOnly = () => {
    const next = new Set();
    items.forEach((it) => {
      if (it.isCounted && it.variance !== 0) {
        next.add(it.productId);
      }
    });
    setSelectedIds(next);
  };

  const handleSelectAllCounted = () => {
    const next = new Set();
    items.forEach((it) => {
      if (it.isCounted) {
        next.add(it.productId);
      }
    });
    setSelectedIds(next);
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  // Filter items for display
  const displayedItems = items.filter((it) => {
    if (filterMode === 'differences') return it.isCounted && it.variance !== 0;
    if (filterMode === 'counted') return it.isCounted;
    return true;
  });

  const handleConfirm = () => {
    const productIdsArray = Array.from(selectedIds);
    onConfirmClose(productIdsArray);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ width: '920px', maxWidth: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '16px', margin: 0 }}>🏁 Finalizar Toma de Inventario</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {session.name} ({session.scope === 'ALL' ? 'Toda la Tienda' : `Zona: ${session.scope}`})
            </span>
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

        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL ÍTEMS</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{totalItems}</div>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>CONTADOS</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{countedItems}</div>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>CON DIFERENCIA</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{differenceItems}</div>
            </div>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>IMPACTO ESTIMADO</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: totalFinancialImpact < 0 ? '#dc2626' : '#059669' }}>
                ${totalFinancialImpact.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Rule 7: Zone Scope Warning */}
          {session.scope !== 'ALL' && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#92400e',
                marginBottom: '14px',
                lineHeight: 1.4,
              }}
            >
              ⚠️ <strong>Alcance de Zona ({session.scope}):</strong> Recuerda que el stock del sistema
              representa el total de la tienda (estante + bodega). Asegúrate de haber contado todas
              las ubicaciones físicas antes de sobrescribir el stock de estos productos.
            </div>
          )}

          {/* Rule 4: Uncounted Safety Notice */}
          {uncountedItems > 0 && (
            <div
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#475569',
                marginBottom: '14px',
              }}
            >
              🛡️ <strong>Protección de Stock:</strong> Hay {uncountedItems} producto(s) no contados. Sus
              casillas están deshabilitadas para que su stock actual no sea alterado ni puesto en cero.
            </div>
          )}

          {/* Master Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${filterMode === 'differences' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterMode('differences')}
              >
                Con Diferencias ({differenceItems})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterMode('all')}
              >
                Ver Todos ({totalItems})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterMode === 'counted' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterMode('counted')}
              >
                Sólo Contados ({countedItems})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-sm btn-clear"
                onClick={handleSelectDifferencesOnly}
                title="Seleccionar sólo con diferencias"
                style={{ fontSize: '12px' }}
              >
                ☑️ Sólo Diferencias
              </button>
              <button
                type="button"
                className="btn btn-sm btn-clear"
                onClick={handleSelectAllCounted}
                title="Seleccionar todos los contados"
                style={{ fontSize: '12px' }}
              >
                ☑️ Todos Contados
              </button>
              <button
                type="button"
                className="btn btn-sm btn-clear"
                onClick={handleClearAll}
                title="Desmarcar todos"
                style={{ fontSize: '12px', color: '#64748b' }}
              >
                ⬜ Desmarcar
              </button>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="table-container" style={{ maxHeight: '380px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>AJUSTAR</th>
                  <th>CÓDIGO / NOMBRE</th>
                  <th style={{ width: '130px' }}>UBICACIÓN</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>INICIAL</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>FÍSICO</th>
                  <th style={{ width: '85px', textAlign: 'right' }}>VARIANZA</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>IMPACTO ($)</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No hay productos en esta vista.
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((it) => {
                    const isSelected = selectedIds.has(it.productId);
                    const isPositive = it.variance > 0;
                    const isNegative = it.variance < 0;

                    return (
                      <tr
                        key={it.id}
                        style={{
                          background: isSelected ? '#f8fafc' : undefined,
                          opacity: !it.isCounted ? 0.6 : 1,
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!it.isCounted}
                            onChange={() => handleToggleItem(it.productId, it.isCounted)}
                            style={{ cursor: it.isCounted ? 'pointer' : 'not-allowed' }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{it.productName}</div>
                          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                            {it.barcode}
                          </div>
                        </td>
                        <td>
                          <div>{it.location || 'General'}</div>
                          {it.breakdown && (
                            <div style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>
                              📍 {it.breakdown}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.systemStockAtStart}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: it.isCounted ? '#0f172a' : '#94a3b8' }}>
                          {it.isCounted ? it.countedQty : 'Pendiente'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isNegative ? '#dc2626' : isPositive ? '#16a34a' : '#64748b',
                          }}
                        >
                          {!it.isCounted ? '-' : (isPositive ? `+${it.variance}` : it.variance)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: isNegative ? '#dc2626' : isPositive ? '#16a34a' : '#64748b',
                          }}
                        >
                          {!it.isCounted ? '-' : `$${it.difference.toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-secondary" onClick={onExportCSV}>
            💾 Exportar CSV
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Seguir Contando
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              style={{ background: '#059669', borderColor: '#047857' }}
            >
              ✅ Finalizar ({selectedIds.size} ajustes)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
