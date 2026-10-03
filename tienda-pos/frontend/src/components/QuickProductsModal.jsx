import React, { useState, useEffect } from 'react';

export default function QuickProductsModal({ isOpen, onClose, quickProducts, onSelectProduct }) {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredProducts = quickProducts.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.toLowerCase().includes(term));
  });

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ width: '90%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h3>Productos de Acceso Rápido</h3>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#64748b' }}
          >
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ flexGrow: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="text"
            placeholder="Buscar producto rápido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            autoFocus
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '15px',
            overflowY: 'auto',
            paddingRight: '5px'
          }}>
            {filteredProducts.map(product => (
              <div
                key={product.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '15px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', lineHeight: '1.2' }}>{product.name}</div>
                  <div style={{ fontSize: '18px', color: '#059669', fontWeight: 'bold', marginBottom: '5px' }}>
                    ${product.price.toLocaleString('es-CO')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
                    Stock: {product.stock}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    onSelectProduct(product);
                  }}
                >
                  <span style={{ fontSize: '20px' }}>+1</span> Al carrito
                </button>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#64748b' }}>
                No se encontraron productos rápidos con "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
