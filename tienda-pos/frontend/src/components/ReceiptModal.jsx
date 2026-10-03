import React, { useEffect, useRef } from 'react';

export default function ReceiptModal({
  isOpen,
  onClose,
  sale,
  storeConfig,
}) {
  const receiptRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        window.print();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sale) return null;

  const config = storeConfig || {
    storeName: 'MI TIENDA DE ABARROTES',
    ownerName: 'Propietario',
    nitOrCedula: '',
    address: '',
    phone: '',
    receiptFooter: 'Documento para Control Interno - Persona Natural No Responsable del IVA (Art. 437 Par. 3 E.T.). No válido para deducción fiscal.',
  };

  const handlePrint = () => {
    window.print();
  };

  const paymentLabels = {
    cash: 'Efectivo',
    transfer: 'Transferencia / Nequi / Daviplata',
    card: 'Tarjeta Débito/Crédito',
    fiao: 'Crédito de Confianza (El Fiao)',
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '420px', width: '95%', padding: '20px' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>🖨️ Vista Previa del Tiquete</h3>
          <button type="button" className="btn btn-clear" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Thermal Receipt Body */}
        <div
          id="printable-receipt"
          ref={receiptRef}
          style={{
            background: '#fff',
            color: '#000',
            padding: '16px 12px',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: 1.3,
            border: '1px dashed #cbd5e1',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <div style={{ fontWeight: 900, fontSize: '15px', textTransform: 'uppercase' }}>
              {config.storeName || 'MI TIENDA'}
            </div>
            {config.ownerName && (
              <div style={{ fontSize: '11px' }}>De: {config.ownerName}</div>
            )}
            {config.nitOrCedula && (
              <div style={{ fontSize: '11px' }}>NIT / CC: {config.nitOrCedula}</div>
            )}
            {config.address && (
              <div style={{ fontSize: '11px' }}>{config.address}</div>
            )}
            {config.phone && (
              <div style={{ fontSize: '11px' }}>Tel: {config.phone}</div>
            )}
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Legal Document Title */}
          <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '13px', margin: '6px 0' }}>
            COMPROBANTE DE VENTA INTERNO
          </div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>
            Nº {sale.ticketNumber}
          </div>
          <div style={{ textAlign: 'center', fontSize: '10px', color: '#555' }}>
            Fecha: {sale.createdAt || new Date().toLocaleString()}
          </div>

          {sale.customerName && sale.customerName !== 'Cliente de Mostrador' && (
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              <strong>Cliente:</strong> {sale.customerName}
            </div>
          )}

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Items Table */}
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '2px 0' }}>Cant</th>
                <th style={{ textAlign: 'left', padding: '2px 0' }}>Descripción</th>
                <th style={{ textAlign: 'right', padding: '2px 0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items && sale.items.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ verticalAlign: 'top', padding: '2px 0', width: '30px' }}>
                    {it.qty}x
                  </td>
                  <td style={{ verticalAlign: 'top', padding: '2px 0' }}>
                    <div>{it.productName}</div>
                    <div style={{ fontSize: '9px', color: '#666' }}>
                      ${it.unitPrice?.toLocaleString()} c/u
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top', textAlign: 'right', padding: '2px 0', fontWeight: 700 }}>
                    ${it.subtotal?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900 }}>
            <span>TOTAL A PAGAR:</span>
            <span>${sale.totalAmount?.toLocaleString()}</span>
          </div>

          <div style={{ marginTop: '4px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Medio de Pago:</span>
              <span>{paymentLabels[sale.paymentMethod] || sale.paymentMethod}</span>
            </div>
            {sale.paymentMethod === 'cash' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Efectivo Recibido:</span>
                  <span>${sale.amountPaid?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Devuelta / Cambio:</span>
                  <span>${sale.changeDue?.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '10px 0 6px 0' }} />

          {/* Legal Footer Legend */}
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#444', lineHeight: 1.2 }}>
            {config.receiptFooter || 'Documento para Control Interno - Persona Natural No Responsable del IVA (Art. 437 Par. 3 E.T.). No válido para deducción fiscal.'}
          </div>

          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px', fontWeight: 700 }}>
            ¡Gracias por su compra!
          </div>
        </div>

        {/* Action Buttons (Excluded from print) */}
        <div className="no-print" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" className="btn btn-clear" onClick={onClose}>
            Cerrar (Esc)
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>🖨️ Imprimir Comprobante (Ctrl+P)</span>
          </button>
        </div>
      </div>

      {/* Print-specific CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 80mm;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
