import React, { useState, useEffect } from 'react';
import QuickProductsModal from './QuickProductsModal.jsx';
import sunmiHardware from '../services/sunmiHardware';
import apiAdapter from '../services/apiAdapter';

export default function POSView({
  products,
  cart,
  setCart,
  lastScannedProduct,
  unregisteredBarcode,
  onRegisterProduct,
  onClearCart,
  onOpenCheckout,
  onClearLastScanned,
}) {
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('10');
  const [heldCarts, setHeldCarts] = useState([]);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);

  const quickProducts = (products || []).filter(p => p.isQuickAccess && p.active);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0 && onOpenCheckout) {
          onOpenCheckout();
        }
      } else if (e.key === 'Escape') {
        if (onClearLastScanned && (lastScannedProduct || unregisteredBarcode)) {
          onClearLastScanned();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, onOpenCheckout, onClearLastScanned, lastScannedProduct, unregisteredBarcode]);

  const handleQtyChange = (index, val) => {
    const qty = parseInt(val, 10);
    if (qty > 0) {
      setCart((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, qty } : item))
      );
    }
  };

  const handleRemove = (index) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + (item.price || 0) * (item.qty || 1),
    0
  );
  const totalCount = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

  const handleQuickRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!unregisteredBarcode || !newProdName.trim()) return;

    await onRegisterProduct({
      barcode: unregisteredBarcode,
      name: newProdName.trim(),
      costPrice: 0,
      price: parseFloat(newProdPrice) || 0,
      stock: parseInt(newProdStock, 10) || 0,
      active: true,
      unitOfMeasure: 'und',
    });

    setNewProdName('');
    setNewProdPrice('');
    setNewProdStock('10');
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    setHeldCarts([...heldCarts, { id: Date.now(), cart, time: new Date().toLocaleTimeString() }]);
    onClearCart();
  };

  const handleRestoreCart = (id, cartToRestore) => {
    if (cart.length > 0) {
      setHeldCarts((prev) => [
        ...prev.filter((c) => c.id !== id),
        { id: Date.now(), cart, time: new Date().toLocaleTimeString() }
      ]);
    } else {
      setHeldCarts((prev) => prev.filter((c) => c.id !== id));
    }
    setCart(cartToRestore);
  };

  const handleQuickProduct = (prod) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.name === prod.name && item.barcode === prod.barcode);
      if (existingIdx >= 0) {
        return prev.map((item, idx) => (idx === existingIdx ? { ...item, qty: (item.qty || 1) + 1 } : item));
      } else {
        return [{ ...prod, qty: 1 }, ...prev];
      }
    });
  };

  return (
    <div className="pos-grid">
      {/* Left: Cart Panel */}
      <section className="panel">
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span>Lista de Venta Actual</span>
            <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '10px' }}>
              {totalCount} artículos
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: '#f59e0b', color: '#fff', border: 'none' }}
            onClick={handleHoldCart}
            disabled={cart.length === 0}
            title="Pausar venta actual"
          >
            Pausar Venta ⏸️
          </button>
        </div>

        {/* Quick Products Bar */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 0', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {quickProducts.slice(0, 6).map((qp) => (
            <button
              key={qp.id}
              onClick={() => handleQuickProduct(qp)}
              style={{
                background: '#e0f2fe',
                border: '1px solid #bae6fd',
                color: '#0369a1',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {qp.name} ${(qp.price || 0).toLocaleString('es-CO')}
            </button>
          ))}
          {quickProducts.length > 0 && (
            <button
              onClick={() => setIsQuickModalOpen(true)}
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                color: '#475569',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              [➕ Ver todos ({quickProducts.length})]
            </button>
          )}
        </div>

        {/* Held Carts */}
        {heldCarts.length > 0 && (
          <div style={{ padding: '10px', background: '#fef3c7', borderBottom: '1px solid #fde68a', display: 'flex', gap: '10px', overflowX: 'auto' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', alignSelf: 'center' }}>Ventas en Espera:</span>
            {heldCarts.map((hc) => (
              <button
                key={hc.id}
                onClick={() => handleRestoreCart(hc.id, hc.cart)}
                style={{
                  background: '#fff',
                  border: '1px solid #fcd34d',
                  color: '#b45309',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Retomar ({hc.time}) - {hc.cart.length} art.
              </button>
            ))}
          </div>
        )}

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>CÓDIGO</th>
                <th>DESCRIPCIÓN</th>
                <th>PRECIO</th>
                <th>CANT.</th>
                <th>SUBTOTAL</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                    Venta vacía. Pasa un producto frente al escáner o busca por nombre arriba.
                  </td>
                </tr>
              ) : (
                cart.map((item, idx) => {
                  const sub = (item.price || 0) * (item.qty || 1);
                  const isStockWarning = (item.stock || 0) - (item.qty || 1) < 0;
                  
                  return (
                    <tr key={`${item.id || item.barcode}-${idx}`} style={isStockWarning ? { backgroundColor: '#fffbeb' } : {}}>
                      <td style={{ fontFamily: 'monospace', color: '#64748b' }}>
                        {item.barcode}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {item.name}
                        {item.location && (
                          <span style={{ fontSize: '11px', color: '#059669', marginLeft: '6px' }}>
                            📍 {item.location}
                          </span>
                        )}
                        {isStockWarning && (
                          <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px' }}>
                            ⚠️ Stock: {item.stock || 0} (quedará en {(item.stock || 0) - (item.qty || 1)})
                          </div>
                        )}
                      </td>
                      <td>${(item.price || 0).toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          style={{ width: '55px', padding: '3px', fontWeight: 700 }}
                        />
                      </td>
                      <td style={{ fontWeight: 700 }}>${sub.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-clear"
                          onClick={() => handleRemove(idx)}
                          title="Eliminar artículo"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="footer-total" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button
              type="button"
              className="btn btn-clear"
              onClick={onClearCart}
              disabled={cart.length === 0}
            >
              Limpiar Venta
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Total a Cobrar:</span>
              <span className="total-price" style={{ marginLeft: '10px' }}>
                ${totalAmount.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenCheckout}
              disabled={cart.length === 0}
              style={{
                backgroundColor: cart.length === 0 ? '#9ca3af' : '#059669',
                fontSize: '18px',
                fontWeight: 700,
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                border: 'none',
                color: 'white'
              }}
            >
              COBRAR (F12)
            </button>
          </div>
        </div>
      </section>

      {/* Right: Last Scanned Item / Quick Register Form */}
      <section className="panel">
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Último Producto Escaneado</span>
          {(lastScannedProduct || unregisteredBarcode) && onClearLastScanned && (
            <button
              type="button"
              className="btn btn-sm btn-clear"
              onClick={onClearLastScanned}
              title="Limpiar vista de producto (Esc)"
              style={{ fontSize: '11px', padding: '2px 8px', color: '#64748b' }}
            >
              ✕ Limpiar vista
            </button>
          )}
        </div>

        {unregisteredBarcode ? (
          <div>
            <div className="card-active" style={{ borderColor: '#f59e0b', background: '#fffbeb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d97706', fontWeight: 700, fontSize: '12px' }}>
                  ⚠️ CÓDIGO NO REGISTRADO
                </span>
                {onClearLastScanned && (
                  <button
                    type="button"
                    onClick={onClearLastScanned}
                    className="btn btn-sm btn-clear"
                    title="Descartar código"
                    style={{ fontSize: '12px', padding: '0 4px', color: '#b45309' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <h3 style={{ fontFamily: 'monospace', margin: '8px 0' }}>
                {unregisteredBarcode}
              </h3>
              <p style={{ color: '#64748b', fontSize: '12px' }}>
                Ingresa los datos para registrarlo e ingresarlo a la venta de inmediato:
              </p>
            </div>

            <form onSubmit={handleQuickRegisterSubmit} style={{ marginTop: '14px' }}>
              <div className="form-group">
                <label>Nombre del Producto (*):</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="Ej: Arroz Diana 500g"
                  autoFocus
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label>Precio (*):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Stock Inicial (*):</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Guardar e Ingresar a Venta
                </button>
                {onClearLastScanned && (
                  <button
                    type="button"
                    className="btn btn-clear"
                    onClick={onClearLastScanned}
                    title="Descartar código escaneado"
                  >
                    Descartar
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : lastScannedProduct ? (
          <div className="card-active" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ color: '#059669', fontWeight: 700, fontSize: '12px' }}>
                PRODUCTO INGRESADO
              </span>
              {onClearLastScanned && (
                <button
                  type="button"
                  onClick={onClearLastScanned}
                  className="btn btn-sm btn-clear"
                  title="Limpiar panel (Esc)"
                  style={{ fontSize: '12px', padding: '1px 6px', color: '#64748b' }}
                >
                  ✕
                </button>
              )}
            </div>
            <h3 style={{ margin: '6px 0' }}>{lastScannedProduct.name}</h3>
            <div style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '13px' }}>
              {lastScannedProduct.barcode}
            </div>
            <div className="card-price">${(lastScannedProduct.price || 0).toFixed(2)}</div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Stock: {lastScannedProduct.stock} {lastScannedProduct.unitOfMeasure || 'und'}
              {lastScannedProduct.location && ` | 📍 ${lastScannedProduct.location}`}
            </div>
          </div>
        ) : (
          <div className="card-active">
            <p style={{ color: '#94a3b8' }}>
              Pasa un producto frente al lector o busca por nombre arriba...
            </p>
          </div>
        )}
      </section>

      <QuickProductsModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        quickProducts={quickProducts}
        onSelectProduct={(prod) => {
          handleQuickProduct(prod);
          setIsQuickModalOpen(false);
        }}
      />
    </div>
  );
}
