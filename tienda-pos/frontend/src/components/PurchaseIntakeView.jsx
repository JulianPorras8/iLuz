import React, { useState, useRef, useEffect } from 'react';

export default function PurchaseIntakeView({
  suppliers = [],
  products = [],
  activePurchase = null,
  onStartPurchase,
  onAddItemToPurchase,
  onUpdateItemInPurchase,
  onRemoveItemFromPurchase,
  onFinalizePurchase,
  onCancelPurchase,
}) {
  const [headerData, setHeaderData] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Contado',
    notes: '',
    attachmentName: '',
    attachmentPath: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const scanInputRef = useRef(null);

  useEffect(() => {
    if (activePurchase && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activePurchase]);

  const handleHeaderChange = (field, value) => {
    setHeaderData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setHeaderData((prev) => ({
        ...prev,
        attachmentName: file.name,
        attachmentPath: file.name, // In webview this holds the name/path
      }));
    }
  };

  const removeAttachment = () => {
    setHeaderData((prev) => ({ ...prev, attachmentName: '', attachmentPath: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startPurchaseSession = () => {
    if (!headerData.supplierId) {
      alert('Por favor selecciona un proveedor.');
      return;
    }
    if (!headerData.invoiceNumber.trim()) {
      alert('Por favor ingresa el número de factura o remisión.');
      return;
    }
    if (onStartPurchase) {
      onStartPurchase(headerData);
    }
  };

  const handleManualSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      const p = products.find(
        (prod) =>
          prod.barcode?.toLowerCase() === query ||
          prod.name?.toLowerCase().includes(query)
      );
      if (p) {
        onAddItemToPurchase({
          id: p.id,
          productId: p.id,
          barcode: p.barcode,
          name: p.name,
          unitCost: p.costPrice || 0,
          previousCost: p.costPrice || 0,
          suggestedPrice: p.price || 0,
          qty: 1,
        });
        setSearchQuery('');
      } else {
        alert('Producto no encontrado en el catálogo');
      }
    }
  };

  const handleManualScanInput = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const barcode = e.target.value.trim();
      const p = products.find((prod) => prod.barcode === barcode);
      if (p) {
        onAddItemToPurchase({
          id: p.id,
          productId: p.id,
          barcode: p.barcode,
          name: p.name,
          unitCost: p.costPrice || 0,
          previousCost: p.costPrice || 0,
          suggestedPrice: p.price || 0,
          qty: 1,
        });
      } else {
        alert(`Código no registrado en catálogo: ${barcode}`);
      }
      e.target.value = '';
    }
  };

  const items = activePurchase?.items || [];
  const totalCost = items.reduce((acc, it) => acc + (it.qty || 1) * (it.unitCost || 0), 0);
  const totalItemsCount = items.reduce((acc, it) => acc + (it.qty || 1), 0);

  const handleFinalize = () => {
    if (items.length === 0) {
      alert('Debes agregar al menos un producto a la factura.');
      return;
    }
    if (window.confirm('¿Confirmas el ingreso de estos productos a inventario? El stock y los costos se actualizarán inmediatamente.')) {
      onFinalizePurchase({
        ...headerData,
        supplierId: parseInt(headerData.supplierId, 10),
        items: items.map((it) => ({
          productId: it.productId || it.id,
          barcode: it.barcode,
          productName: it.name,
          qty: it.qty,
          unitCost: it.unitCost,
          suggestedPrice: it.suggestedPrice || 0,
        })),
        totalCost,
      });
    }
  };

  const activeSupplier = suppliers.find((s) => String(s.id) === String(headerData.supplierId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', overflowY: 'auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>
            📥 Entrada de Mercancía por Pedido / Factura de Proveedor
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Recepción de pedidos, ajuste de costos de compra e incremento automático de existencias
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Left Panel: Invoice Data */}
        <div
          className="panel"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            📄 Datos de la Factura
          </h3>

          {/* Supplier */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Proveedor (*):</label>
            <select
              value={headerData.supplierId}
              onChange={(e) => handleHeaderChange('supplierId', e.target.value)}
              disabled={Boolean(activePurchase)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: activePurchase ? '#f1f5f9' : '#fff',
              }}
            >
              <option value="">-- Seleccionar Proveedor --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.nitOrCedula ? `(${s.nitOrCedula})` : ''}
                </option>
              ))}
            </select>
            {activeSupplier?.phone && (
              <span style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>
                📞 Contacto: {activeSupplier.contactName || activeSupplier.name} ({activeSupplier.phone})
              </span>
            )}
          </div>

          {/* Invoice Number */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>N° Factura / Remisión (*):</label>
            <input
              type="text"
              value={headerData.invoiceNumber}
              onChange={(e) => handleHeaderChange('invoiceNumber', e.target.value)}
              disabled={Boolean(activePurchase)}
              placeholder="Ej: FAC-10294"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'monospace',
                background: activePurchase ? '#f1f5f9' : '#fff',
              }}
            />
          </div>

          {/* Date & Payment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Fecha Factura:</label>
              <input
                type="date"
                value={headerData.invoiceDate}
                onChange={(e) => handleHeaderChange('invoiceDate', e.target.value)}
                disabled={Boolean(activePurchase)}
                style={{
                  width: '100%',
                  padding: '7px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  background: activePurchase ? '#f1f5f9' : '#fff',
                }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Forma Pago:</label>
              <select
                value={headerData.paymentMethod}
                onChange={(e) => handleHeaderChange('paymentMethod', e.target.value)}
                disabled={Boolean(activePurchase)}
                style={{
                  width: '100%',
                  padding: '7px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  background: activePurchase ? '#f1f5f9' : '#fff',
                }}
              >
                <option value="Contado">Contado</option>
                <option value="Crédito">Crédito</option>
              </select>
            </div>
          </div>

          {/* Attachment */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Foto o Adjunto de Factura:</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              disabled={Boolean(activePurchase)}
              style={{ display: 'none' }}
              id="purchase-file-input"
            />
            {!headerData.attachmentName ? (
              <button
                type="button"
                className="btn btn-sm btn-clear"
                onClick={() => fileInputRef.current?.click()}
                disabled={Boolean(activePurchase)}
                style={{
                  width: '100%',
                  border: '1px dashed #cbd5e1',
                  padding: '8px',
                  borderRadius: '6px',
                  color: '#475569',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                📎 Adjuntar Factura Escaneada / Foto
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#065f46',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                  ✓ {headerData.attachmentName}
                </span>
                {!activePurchase && (
                  <button
                    type="button"
                    onClick={removeAttachment}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Notas / Observaciones:</label>
            <textarea
              rows={2}
              value={headerData.notes}
              onChange={(e) => handleHeaderChange('notes', e.target.value)}
              disabled={Boolean(activePurchase)}
              placeholder="Ej: Entrega parcial, lote con descuento..."
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                resize: 'none',
                background: activePurchase ? '#f1f5f9' : '#fff',
              }}
            />
          </div>

          {!activePurchase ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={startPurchaseSession}
              style={{
                marginTop: 'auto',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 700,
                background: '#2563eb',
                color: '#fff',
                borderRadius: '8px',
              }}
            >
              🚀 Iniciar Ingreso de Mercancía
            </button>
          ) : (
            <div
              style={{
                padding: '10px',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#166534',
                marginTop: 'auto',
              }}
            >
              🔒 Cabecera bloqueada mientras se ingresan productos.
            </div>
          )}
        </div>

        {/* Right Panel: Items & Scan Active Session */}
        <div
          className="panel"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {!activePurchase ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '48px' }}>📦</div>
              <h3 style={{ margin: 0, color: '#334155' }}>Ningún ingreso de pedido activo</h3>
              <p style={{ margin: 0, fontSize: '13px', textAlign: 'center', maxWidth: '380px' }}>
                Selecciona el proveedor en el panel de la izquierda, escribe el número de factura y presiona{' '}
                <strong>"Iniciar Ingreso de Mercancía"</strong> para activar el escaneo rápido.
              </p>
            </div>
          ) : (
            <>
              {/* Active Scanner Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#ecfdf5',
                  border: '1px solid #6ee7b7',
                  borderRadius: '8px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🟢</span>
                  <div>
                    <span style={{ fontWeight: 700, color: '#065f46', fontSize: '13px' }}>
                      MODO INGRESO ACTIVO: Factura #{headerData.invoiceNumber}
                    </span>
                    <span style={{ fontSize: '11px', color: '#047857', display: 'block' }}>
                      Cada escaneo agregará el producto a esta factura e incrementará el inventario
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={scanInputRef}
                    type="text"
                    onKeyDown={handleManualScanInput}
                    placeholder="Escáner listo..."
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      borderRadius: '6px',
                      border: '1px solid #a7f3d0',
                      width: '160px',
                    }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleManualSearch}
                    placeholder="🔍 Buscar por nombre..."
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      width: '190px',
                    }}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>CÓDIGO</th>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>PRODUCTO</th>
                      <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'center', width: '130px' }}>CANTIDAD</th>
                      <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'right', width: '130px' }}>COSTO UNIT.</th>
                      <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'right', width: '120px' }}>SUBTOTAL</th>
                      <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'right', width: '130px' }}>P. VENTA SUG.</th>
                      <th style={{ padding: '8px 10px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                          Pasa los productos del pedido frente al escáner para registrarlos en la factura.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const lineSubtotal = (item.qty || 1) * (item.unitCost || 0);
                        const costIncreased = item.previousCost > 0 && item.unitCost > item.previousCost;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#64748b' }}>
                              {item.barcode}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>
                              {item.name}
                              {costIncreased && (
                                <span style={{ fontSize: '10px', color: '#b45309', background: '#fef3c7', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px' }}>
                                  ▲ Costo subió (Antes: ${Number(item.previousCost).toLocaleString('es-CO')})
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-clear"
                                  onClick={() => onUpdateItemInPurchase(idx, 'qty', Math.max(1, (item.qty || 1) - 1))}
                                  style={{ padding: '2px 8px', fontWeight: 700 }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.qty}
                                  onChange={(e) => onUpdateItemInPurchase(idx, 'qty', parseInt(e.target.value, 10) || 1)}
                                  style={{ width: '50px', textAlign: 'center', padding: '3px', fontWeight: 700 }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-sm btn-clear"
                                  onClick={() => onUpdateItemInPurchase(idx, 'qty', (item.qty || 1) + 1)}
                                  style={{ padding: '2px 8px', fontWeight: 700 }}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.unitCost}
                                onChange={(e) => onUpdateItemInPurchase(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                style={{ width: '90px', textAlign: 'right', padding: '3px', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              ${lineSubtotal.toLocaleString('es-CO')}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.suggestedPrice || ''}
                                onChange={(e) => onUpdateItemInPurchase(idx, 'suggestedPrice', parseFloat(e.target.value) || 0)}
                                placeholder="P. Venta"
                                style={{ width: '90px', textAlign: 'right', padding: '3px', color: '#059669', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => onRemoveItemFromPurchase(idx)}
                                style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px' }}
                                title="Eliminar ítem"
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

              {/* Bottom Totals and Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Artículos en Factura: <strong>{totalItemsCount}</strong> ({items.length} productos distintos)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Total Costo Factura:</span>
                    <strong style={{ fontSize: '20px', color: '#0f172a', marginLeft: '8px' }}>
                      ${totalCost.toLocaleString('es-CO')}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="btn btn-clear"
                    onClick={() => {
                      if (window.confirm('¿Cancelar este ingreso? Se descartarán los productos leídos.')) {
                        onCancelPurchase();
                      }
                    }}
                    style={{ color: '#ef4444' }}
                  >
                    Descartar Entrada
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleFinalize}
                    disabled={items.length === 0}
                    style={{
                      background: items.length === 0 ? '#94a3b8' : '#059669',
                      padding: '10px 22px',
                      fontSize: '15px',
                      fontWeight: 700,
                      borderRadius: '8px',
                    }}
                  >
                    ✅ Finalizar e Ingresar a Inventario
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
