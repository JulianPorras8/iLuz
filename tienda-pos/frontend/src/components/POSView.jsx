import React, { useState } from 'react';

export default function POSView({
  cart,
  setCart,
  lastScannedProduct,
  unregisteredBarcode,
  onRegisterProduct,
  onClearCart,
}) {
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('10');

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
      price: parseFloat(newProdPrice) || 0,
      stock: parseInt(newProdStock, 10) || 0,
      active: true,
      unitOfMeasure: 'und',
    });

    setNewProdName('');
    setNewProdPrice('');
    setNewProdStock('10');
  };

  return (
    <div className="pos-grid">
      {/* Left: Cart Panel */}
      <section className="panel">
        <div className="panel-title">
          <span>Lista de Venta Actual</span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {totalCount} artículos
          </span>
        </div>

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
                  return (
                    <tr key={`${item.id || item.barcode}-${idx}`}>
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

        <div className="footer-total">
          <button
            type="button"
            className="btn btn-clear"
            onClick={onClearCart}
            disabled={cart.length === 0}
          >
            Limpiar Venta
          </button>
          <div>
            <span style={{ fontSize: '14px', color: '#64748b' }}>Total a Cobrar:</span>
            <span className="total-price" style={{ marginLeft: '10px' }}>
              ${totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* Right: Last Scanned Item / Quick Register Form */}
      <section className="panel">
        <div className="panel-title">Último Producto Escaneado</div>

        {unregisteredBarcode ? (
          <div>
            <div className="card-active" style={{ borderColor: '#f59e0b', background: '#fffbeb' }}>
              <div style={{ color: '#d97706', fontWeight: 700, fontSize: '12px' }}>
                ⚠️ CÓDIGO NO REGISTRADO
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

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
                Guardar e Ingresar a Venta
              </button>
            </form>
          </div>
        ) : lastScannedProduct ? (
          <div className="card-active">
            <div style={{ color: '#059669', fontWeight: 700, fontSize: '12px' }}>
              PRODUCTO INGRESADO
            </div>
            <h3>{lastScannedProduct.name}</h3>
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
    </div>
  );
}
