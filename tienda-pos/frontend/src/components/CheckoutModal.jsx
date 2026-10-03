import React, { useState, useEffect } from 'react';

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  totalAmount,
  storeConfig,
  currentShift,
  onCompleteSale,
}) {
  const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, transfer, card, fiao
  const [amountPaid, setAmountPaid] = useState('');
  const [customerName, setCustomerName] = useState('Cliente de Mostrador');
  const [notes, setNotes] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);
  const [creditAccounts, setCreditAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmountPaid(totalAmount > 0 ? String(totalAmount) : '');
      setPaymentMethod('cash');
      setCustomerName('Cliente de Mostrador');
      setNotes('');
      setIsSubmitting(false);

      // Load credit accounts for fiao
      if (window.go?.main?.App?.ListCreditAccounts) {
        window.go.main.App.ListCreditAccounts()
          .then((accs) => setCreditAccounts(accs || []))
          .catch(() => setCreditAccounts([]));
      }
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const paidNum = parseFloat(amountPaid) || 0;
  const changeDue = Math.max(0, paidNum - totalAmount);

  // Check if any product will have negative stock
  const negativeStockItems = cart.filter((item) => (item.stock || 0) - (item.qty || 1) < 0);

  const handleQuickAmount = (val) => {
    if (val === 'exact') {
      setAmountPaid(String(totalAmount));
    } else {
      setAmountPaid(String(val));
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (cart.length === 0 || isSubmitting) return;

    if (paymentMethod === 'cash' && paidNum < totalAmount) {
      alert(`El monto pagado ($${paidNum.toLocaleString()}) es menor al total a cobrar ($${totalAmount.toLocaleString()}).`);
      return;
    }

    if (paymentMethod === 'fiao' && (!customerName.trim() || customerName === 'Cliente de Mostrador')) {
      alert('Para ventas a crédito (Fiao), debes ingresar o seleccionar el nombre del cliente.');
      return;
    }

    setIsSubmitting(true);
    try {
      const saleInput = {
        paymentMethod,
        amountPaid: paymentMethod === 'cash' ? paidNum : totalAmount,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        customerName: customerName.trim() || 'Cliente de Mostrador',
        notes: notes.trim(),
        items: cart.map((it) => ({
          productId: it.id,
          barcode: it.barcode || '',
          productName: it.name || '',
          qty: it.qty || 1,
          unitPrice: it.price || 0,
          costPrice: it.costPrice || 0,
          subtotal: (it.price || 0) * (it.qty || 1),
        })),
      };

      await onCompleteSale(saleInput, printReceipt);
    } catch (err) {
      alert(`Error al registrar la venta: ${err}`);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'F1') {
      e.preventDefault();
      setPaymentMethod('cash');
    } else if (e.key === 'F2') {
      e.preventDefault();
      setPaymentMethod('transfer');
    } else if (e.key === 'F3') {
      e.preventDefault();
      setPaymentMethod('card');
    } else if (e.key === 'F4') {
      e.preventDefault();
      setPaymentMethod('fiao');
    }
  };

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown}>
      <div className="modal-content" style={{ maxWidth: '580px', width: '95%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💵 Finalizar Venta</span>
          </h2>
          <button type="button" className="btn btn-clear" onClick={onClose} style={{ fontSize: '18px' }}>
            ✕
          </button>
        </div>

        {/* Big Total Box */}
        <div style={{
          background: '#047857',
          color: '#fff',
          borderRadius: '10px',
          padding: '16px 20px',
          margin: '16px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
        }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
              Total a Cobrar ({cart.reduce((s, it) => s + (it.qty || 1), 0)} arts)
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800 }}>
              ${totalAmount.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
            </div>
          </div>
          {currentShift ? (
            <div style={{ fontSize: '11px', textAlign: 'right', background: '#065f46', padding: '4px 10px', borderRadius: '6px' }}>
              🟢 Turno #{currentShift.id} Activo
            </div>
          ) : (
            <div style={{ fontSize: '11px', textAlign: 'right', background: '#b91c1c', padding: '4px 10px', borderRadius: '6px' }}>
              ⚠️ Caja Cerrada (Venta sin turno)
            </div>
          )}
        </div>

        {/* Negative Stock Warning (Decision 1) */}
        {negativeStockItems.length > 0 && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            color: '#b45309',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div>
              <strong>Aviso de stock temporalmente negativo:</strong>
              <div>
                {negativeStockItems.map((it) => (
                  <span key={it.id || it.barcode} style={{ display: 'inline-block', marginRight: '8px' }}>
                    • {it.name} (quedará en {(it.stock || 0) - (it.qty || 1)})
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
                Se permite cobrar para no perder la venta. La diferencia se regularizará en la próxima auditoría física.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Payment Method Selector */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
              MÉTODO DE PAGO:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-clear'}`}
                style={{ justifyContent: 'center', fontSize: '13px', padding: '8px 4px' }}
                onClick={() => setPaymentMethod('cash')}
              >
                💵 Efectivo [F1]
              </button>
              <button
                type="button"
                className={`btn ${paymentMethod === 'transfer' ? 'btn-primary' : 'btn-clear'}`}
                style={{ justifyContent: 'center', fontSize: '13px', padding: '8px 4px' }}
                onClick={() => setPaymentMethod('transfer')}
              >
                📱 Nequi/Transf [F2]
              </button>
              <button
                type="button"
                className={`btn ${paymentMethod === 'card' ? 'btn-primary' : 'btn-clear'}`}
                style={{ justifyContent: 'center', fontSize: '13px', padding: '8px 4px' }}
                onClick={() => setPaymentMethod('card')}
              >
                💳 Tarjeta [F3]
              </button>
              <button
                type="button"
                className={`btn ${paymentMethod === 'fiao' ? 'btn-primary' : 'btn-clear'}`}
                style={{ justifyContent: 'center', fontSize: '13px', padding: '8px 4px', background: paymentMethod === 'fiao' ? '#d97706' : '' }}
                onClick={() => setPaymentMethod('fiao')}
              >
                🤝 El Fiao [F4]
              </button>
            </div>
          </div>

          {/* Cash Payment Section */}
          {paymentMethod === 'cash' && (
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Paga con ($ Efectivo):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    style={{ fontSize: '20px', fontWeight: 800, padding: '8px 12px', width: '100%' }}
                    autoFocus
                    required
                  />
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                    CAMBIO / DEVUELTA:
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: changeDue >= 0 ? '#10b981' : '#ef4444' }}>
                    ${changeDue.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-clear" onClick={() => handleQuickAmount('exact')}>
                  Exacto (${totalAmount.toLocaleString()})
                </button>
                {[2000, 5000, 10000, 20000, 50000, 100000].map((val) => (
                  val >= totalAmount ? (
                    <button key={val} type="button" className="btn btn-sm btn-clear" onClick={() => handleQuickAmount(val)}>
                      ${val.toLocaleString()}
                    </button>
                  ) : null
                ))}
              </div>
            </div>
          )}

          {/* Fiao Customer Section */}
          {paymentMethod === 'fiao' && (
            <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '8px', border: '1px solid #fde68a', marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', display: 'block', marginBottom: '6px' }}>
                Nombre del Cliente de Confianza (*):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  list="credit-accounts-list"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej: Don Pedro, Vecina Marta..."
                  style={{ flex: 1, padding: '8px 12px', fontSize: '14px', fontWeight: 600 }}
                  required
                  autoFocus
                />
                <datalist id="credit-accounts-list">
                  {creditAccounts.map((acc) => (
                    <option key={acc.id} value={acc.customerName}>
                      Saldo actual: ${acc.currentDebt?.toLocaleString()} | Cupo: ${acc.creditLimit?.toLocaleString()}
                    </option>
                  ))}
                </datalist>
              </div>
              <div style={{ fontSize: '11px', color: '#b45309', marginTop: '6px' }}>
                Se sumará ${totalAmount.toLocaleString()} a la cuenta por cobrar del cliente.
              </div>
            </div>
          )}

          {/* General Customer Name (if not fiao) */}
          {paymentMethod !== 'fiao' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                Cliente (Opcional):
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Cliente de Mostrador"
                style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
              />
            </div>
          )}

          {/* Print Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <input
              type="checkbox"
              id="printReceiptCheck"
              checked={printReceipt}
              onChange={(e) => setPrintReceipt(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="printReceiptCheck" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              Imprimir Comprobante de Venta Térmico (58mm/80mm)
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-clear" onClick={onClose} disabled={isSubmitting}>
              Cancelar (Esc)
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#059669', borderColor: '#047857', padding: '10px 24px', fontSize: '15px', fontWeight: 700 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Procesando...' : '✓ Confirmar y Cobrar (Enter)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
