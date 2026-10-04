import React, { useState, useEffect, useRef, useMemo } from 'react';

export default function BarcodeLinkModal({
  isOpen,
  barcode,
  products = [],
  onLink,
  onCreateNew,
  onClose,
}) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [initialStock, setInitialStock] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter products: show only active products that don't already have this barcode
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const q = search.trim().toLowerCase();
    const active = products.filter((p) => p.active !== false);
    if (!q) {
      // Prioritize products with internal codes ILUZ- or without standard EAN barcodes
      return active.slice(0, 50);
    }
    return active
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const bc = (p.barcode || '').toLowerCase();
        return name.includes(q) || cat.includes(q) || bc.includes(q);
      })
      .slice(0, 50);
  }, [products, search]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setInitialStock('');
      setErrorMsg('');
      setIsSubmitting(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen, barcode]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= filteredProducts.length) {
      setSelectedIndex(Math.max(0, filteredProducts.length - 1));
    }
  }, [filteredProducts.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex];
      if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0 && selectedIndex < filteredProducts.length) {
        handleConfirmLink(filteredProducts[selectedIndex]);
      }
    }
  };

  const handleConfirmLink = async (targetProduct) => {
    if (!targetProduct || !barcode) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const parsedStock = initialStock.trim() !== '' ? parseInt(initialStock, 10) : null;
      await onLink(targetProduct.id, barcode, parsedStock);
    } catch (err) {
      setErrorMsg(err.message || 'Error al vincular el código de barras');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-container"
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🔗</span>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Pistoleo de Enlace (Vincular Código)
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Asocia este código de barras físico a un producto existente del catálogo en segundos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-clear"
            style={{ fontSize: '20px', padding: '4px 8px', color: '#64748b' }}
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Scanned Barcode Badge */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#eff6ff',
            borderBottom: '1px solid #dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
              Código Pistoleado:
            </span>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: '#1d4ed8' }}>
              {barcode}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: '#475569' }}>
              Navega con <kbd style={{ padding: '2px 5px', background: '#e2e8f0', borderRadius: '4px' }}>↑</kbd>{' '}
              <kbd style={{ padding: '2px 5px', background: '#e2e8f0', borderRadius: '4px' }}>↓</kbd> y pulsa{' '}
              <kbd style={{ padding: '2px 5px', background: '#e2e8f0', borderRadius: '4px', fontWeight: 700 }}>Enter</kbd>
            </span>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              fontSize: '13px',
              borderBottom: '1px solid #fecaca',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Search Bar */}
        <div style={{ padding: '16px 20px 8px 20px' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Escribe nombre del producto (ej: Diana, Aceite, Pan)..."
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '15px',
                borderRadius: '8px',
                border: '2px solid #3b82f6',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Product Suggestions List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 20px',
            maxHeight: '340px',
          }}
        >
          {filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
                No se encontraron productos con "{search}"
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                ¿Es un producto nuevo que no está en el catálogo?
              </p>
            </div>
          ) : (
            filteredProducts.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={p.id || p.barcode}
                  onClick={() => {
                    setSelectedIndex(idx);
                    handleConfirmLink(p);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '6px',
                    backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                    border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '14px',
                          color: isSelected ? '#1d4ed8' : '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                      </span>
                      {p.category && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#e0e7ff',
                            color: '#3730a3',
                            fontWeight: 600,
                          }}
                        >
                          {p.category}
                        </span>
                      )}
                      {p.isQuickAccess && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 600,
                          }}
                        >
                          ⚡ Rápido
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Código actual:{' '}
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.barcode}</span>
                      {p.location && ` • Ubicación: ${p.location}`}
                      {` • Stock: ${p.stock ?? 0}`}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>
                      ${(p.price || 0).toLocaleString('es-CO')}
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#2563eb',
                          fontWeight: 700,
                          display: 'block',
                          marginTop: '2px',
                        }}
                      >
                        [Enter para vincular]
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Stock & Bottom Action Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                📦 Stock actual contado (opcional):
              </label>
              <input
                type="number"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                placeholder="Ej: 12"
                style={{
                  width: '90px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn"
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                }}
                onClick={() => {
                  onClose();
                  if (onCreateNew) onCreateNew(barcode);
                }}
              >
                ➕ Crear como Producto Nuevo
              </button>

              <button
                type="button"
                className="btn btn-primary"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                disabled={isSubmitting || filteredProducts.length === 0}
                onClick={() => {
                  if (filteredProducts[selectedIndex]) {
                    handleConfirmLink(filteredProducts[selectedIndex]);
                  }
                }}
              >
                {isSubmitting ? 'Vinculando...' : '🔗 Vincular Código'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
