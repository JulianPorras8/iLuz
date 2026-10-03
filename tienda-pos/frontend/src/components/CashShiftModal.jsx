import React, { useState, useEffect } from 'react';

const COLOMBIAN_DENOMINATIONS = [
  { value: 100000, label: '$100.000', type: 'bill' },
  { value: 50000, label: '$50.000', type: 'bill' },
  { value: 20000, label: '$20.000', type: 'bill' },
  { value: 10000, label: '$10.000', type: 'bill' },
  { value: 5000, label: '$5.000', type: 'bill' },
  { value: 2000, label: '$2.000', type: 'bill' },
  { value: 1000, label: '$1.000', type: 'coin' },
  { value: 500, label: '$500', type: 'coin' },
  { value: 200, label: '$200', type: 'coin' },
  { value: 100, label: '$100', type: 'coin' },
  { value: 50, label: '$50', type: 'coin' },
];

export default function CashShiftModal({
  isOpen,
  onClose,
  currentShift,
  storeConfig,
  onOpenShift,
  onCloseShift,
}) {
  const [initialCash, setInitialCash] = useState(50000);
  const [cashierName, setCashierName] = useState('');
  const [notes, setNotes] = useState('');
  const [showDenominations, setShowDenominations] = useState(false);
  const [counts, setCounts] = useState({});

  // Close shift state
  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [showCloseDenom, setShowCloseDenom] = useState(false);
  const [closeCounts, setCloseCounts] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (!currentShift) {
        setInitialCash(50000);
        setCashierName(storeConfig?.ownerName || 'Cajero Principal');
        setNotes('');
        setShowDenominations(false);
        setCounts({});
      } else {
        setActualCash('');
        setCloseNotes('');
        setShowCloseDenom(false);
        setCloseCounts({});
      }
    }
  }, [isOpen, currentShift, storeConfig]);

  if (!isOpen) return null;

  // Calculate total from denomination breakdown for opening
  const calcDenomTotal = (countMap) => {
    return COLOMBIAN_DENOMINATIONS.reduce((sum, d) => {
      const q = parseInt(countMap[d.value], 10) || 0;
      return sum + q * d.value;
    }, 0);
  };

  const denomOpenTotal = calcDenomTotal(counts);

  const handleDenomChange = (val, qty) => {
    const num = Math.max(0, parseInt(qty, 10) || 0);
    const updated = { ...counts, [val]: num };
    setCounts(updated);
    setInitialCash(calcDenomTotal(updated));
  };

  const handleCloseDenomChange = (val, qty) => {
    const num = Math.max(0, parseInt(qty, 10) || 0);
    const updated = { ...closeCounts, [val]: num };
    setCloseCounts(updated);
    setActualCash(String(calcDenomTotal(updated)));
  };

  const handleOpenSubmit = (e) => {
    e.preventDefault();
    let finalNotes = notes.trim();
    if (cashierName.trim()) {
      finalNotes = `Responsable: ${cashierName.trim()}${finalNotes ? ` | ${finalNotes}` : ''}`;
    }
    if (showDenominations && denomOpenTotal > 0) {
      const breakdown = COLOMBIAN_DENOMINATIONS.filter((d) => counts[d.value] > 0)
        .map((d) => `${counts[d.value]}x${d.label}`)
        .join(', ');
      if (breakdown) {
        finalNotes += ` [Desglose: ${breakdown}]`;
      }
    }

    onOpenShift(initialCash, finalNotes);
  };

  const handleCloseSubmit = (e, assimilateDifference = false) => {
    e.preventDefault();
    let finalNotes = closeNotes.trim();
    if (showCloseDenom) {
      const breakdown = COLOMBIAN_DENOMINATIONS.filter((d) => closeCounts[d.value] > 0)
        .map((d) => `${closeCounts[d.value]}x${d.label}`)
        .join(', ');
      if (breakdown) {
        finalNotes += ` [Conteo: ${breakdown}]`;
      }
    }

    onCloseShift(
      currentShift.id,
      parseFloat(actualCash) || 0,
      assimilateDifference,
      finalNotes
    );
  };

  const expectedCash = currentShift ? currentShift.expectedCash || 0 : 0;
  const actualCashNum = parseFloat(actualCash);
  const hasEnteredActual = actualCash !== '' && !isNaN(actualCashNum);
  const difference = hasEnteredActual ? actualCashNum - expectedCash : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '580px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* MODAL HEADER */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!currentShift ? '🟢 Apertura de Turno de Caja' : `🔴 Cierre y Arqueo de Turno #${currentShift.id}`}
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {!currentShift
                ? 'Registra la base inicial en gaveta para comenzar las ventas'
                : 'Arqueo de efectivo físico y balance final del turno'}
            </span>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} title="Cerrar ventana">
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="modal-body" style={{ padding: '16px' }}>
          {!currentShift ? (
            /* --- APERTURA DE TURNO --- */
            <form onSubmit={handleOpenSubmit}>
              {/* Date & Responsible Row */}
              <div className="grid-2" style={{ marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Fecha y Hora de Apertura:
                  </label>
                  <input
                    type="text"
                    disabled
                    value={new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) + ' - Hoy'}
                    style={{ background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Cajero(a) / Responsable:
                  </label>
                  <input
                    type="text"
                    required
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    placeholder="Nombre del cajero"
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Big Initial Cash Card */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '2px solid #86efac',
                  borderRadius: '10px',
                  padding: '16px',
                  textAlign: 'center',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Base Inicial en Gaveta (Efectivo)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#15803d' }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={initialCash}
                    onChange={(e) => setInitialCash(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{
                      fontSize: '28px',
                      fontWeight: 800,
                      color: '#15803d',
                      textAlign: 'center',
                      width: '200px',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      padding: '4px',
                      background: 'white',
                    }}
                    autoFocus
                  />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>COP</span>
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                  {initialCash === 0 ? 'Sin base de cambio' : `$${Number(initialCash).toLocaleString('es-CO')} pesos`}
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Bases rápidas frecuentes:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '$0 (Sin base)', val: 0 },
                    { label: '$20.000', val: 20000 },
                    { label: '$50.000 ⭐ Habitual', val: 50000 },
                    { label: '$100.000', val: 100000 },
                    { label: '$200.000', val: 200000 },
                  ].map((p) => {
                    const isSelected = initialCash === p.val;
                    return (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => {
                          setInitialCash(p.val);
                          setCounts({});
                          setShowDenominations(false);
                        }}
                        style={{
                          flex: 1,
                          minWidth: '85px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #059669' : '1px solid #cbd5e1',
                          background: isSelected ? '#ecfdf5' : 'white',
                          color: isSelected ? '#065f46' : '#334155',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Denomination Breakdown Section */}
              <div style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', background: '#fafafa' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowDenominations(!showDenominations)}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    🔢 Contar por billetes y monedas (opcional)
                  </span>
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                    {showDenominations ? '▲ Ocultar' : '▼ Desglosar'}
                  </span>
                </div>

                {showDenominations && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                      {COLOMBIAN_DENOMINATIONS.map((d) => (
                        <div
                          key={d.value}
                          style={{
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '6px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 700, color: d.type === 'bill' ? '#0f766e' : '#b45309' }}>
                            {d.label}
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={counts[d.value] || ''}
                            onChange={(e) => handleDenomChange(d.value, e.target.value)}
                            placeholder="0"
                            style={{
                              width: '100%',
                              textAlign: 'center',
                              padding: '2px',
                              fontSize: '12px',
                              fontWeight: 700,
                              marginTop: '4px',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {denomOpenTotal > 0 && (
                      <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '12px', color: '#059669', fontWeight: 700 }}>
                        Total Conteo: ${denomOpenTotal.toLocaleString('es-CO')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                  Observaciones / Novedades de Entrega (Opcional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Turno mañana, billetes de cambio recibidos de Juan..."
                  style={{ fontSize: '13px' }}
                />
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-clear" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  style={{ padding: '10px 22px', fontSize: '14px', fontWeight: 700 }}
                >
                  🟢 Abrir Turno de Caja
                </button>
              </div>
            </form>
          ) : (
            /* --- CIERRE Y ARQUEO DE TURNO --- */
            <form onSubmit={(e) => handleCloseSubmit(e, false)}>
              {/* Shift Live Statistics Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Resumen de Movimientos del Turno
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Base Inicial:</span>{' '}
                    <strong>${(currentShift.initialCash || 0).toLocaleString('es-CO')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Ventas Efectivo:</span>{' '}
                    <strong style={{ color: '#059669' }}>+${(currentShift.cashSales || 0).toLocaleString('es-CO')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Ventas Transferencia:</span>{' '}
                    <strong>${(currentShift.transferSales || 0).toLocaleString('es-CO')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Ventas a Crédito (Fiao):</span>{' '}
                    <strong style={{ color: '#d97706' }}>${(currentShift.creditSales || 0).toLocaleString('es-CO')}</strong>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid #cbd5e1',
                    marginTop: '10px',
                    paddingTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Total Efectivo Esperado en Gaveta:
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>
                    ${expectedCash.toLocaleString('es-CO')} COP
                  </span>
                </div>
              </div>

              {/* Physical Cash Count Input */}
              <div
                style={{
                  background: '#fff',
                  border: '2px solid #3b82f6',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '16px',
                }}
              >
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: '6px' }}>
                  Efectivo Físico Contado en Gaveta (*):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#1e40af' }}>$</span>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    required
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="Digita el dinero real en caja"
                    style={{
                      flex: 1,
                      fontSize: '20px',
                      fontWeight: 800,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #93c5fd',
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-clear"
                    onClick={() => setActualCash(String(expectedCash))}
                    title="Asumir caja exacta sin diferencias"
                    style={{ fontSize: '11px', padding: '6px 10px' }}
                  >
                    Exacto
                  </button>
                </div>
              </div>

              {/* Optional Denomination Breakdown for Closing */}
              <div style={{ marginBottom: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', background: '#fafafa' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowCloseDenom(!showCloseDenom)}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    🔢 Conteo detallado de billetes y monedas (opcional)
                  </span>
                  <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>
                    {showCloseDenom ? '▲ Ocultar' : '▼ Desglosar'}
                  </span>
                </div>
                {showCloseDenom && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '6px' }}>
                      {COLOMBIAN_DENOMINATIONS.map((d) => (
                        <div key={d.value} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px', textAlign: 'center' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: d.type === 'bill' ? '#0f766e' : '#b45309' }}>{d.label}</div>
                          <input
                            type="number"
                            min="0"
                            value={closeCounts[d.value] || ''}
                            onChange={(e) => handleCloseDenomChange(d.value, e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', textAlign: 'center', padding: '1px', fontSize: '11px' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Difference Status Box */}
              {hasEnteredActual && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    background: difference === 0 ? '#f0fdf4' : difference > 0 ? '#eff6ff' : '#fef2f2',
                    border: `1px solid ${difference === 0 ? '#86efac' : difference > 0 ? '#93c5fd' : '#fca5a5'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: difference === 0 ? '#15803d' : difference > 0 ? '#1d4ed8' : '#b91c1c' }}>
                      {difference === 0 ? '✓ Caja Cuadrada Perfecta' : difference > 0 ? '📈 Sobrante en Gaveta' : '📉 Faltante en Gaveta'}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: difference === 0 ? '#15803d' : difference > 0 ? '#1d4ed8' : '#b91c1c' }}>
                      {difference >= 0 ? `+$${difference.toLocaleString('es-CO')}` : `-$${Math.abs(difference).toLocaleString('es-CO')}`}
                    </span>
                  </div>

                  {difference > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ fontSize: '11px', color: '#1e40af', margin: '0 0 8px 0' }}>
                        💡 Tienes más dinero en gaveta del registrado por ventas. Puedes asimilarlo automáticamente como una venta rápida no marcada para que tu reporte diario cuadre a cero (Art. 616-2 E.T.).
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={(e) => handleCloseSubmit(e, true)}
                        style={{
                          width: '100%',
                          background: '#2563eb',
                          fontSize: '12px',
                          padding: '8px',
                          fontWeight: 700,
                        }}
                      >
                        ⚡ Cerrar Asimilando Sobrante (+${difference.toLocaleString('es-CO')}) como Venta Rápida
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Close Notes */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                  Notas de Cierre:
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ej: Se entregaron $50k de base al turno de la tarde..."
                  style={{ fontSize: '13px' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-clear" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={(e) => handleCloseSubmit(e, false)}
                  disabled={!hasEnteredActual}
                  style={{ padding: '8px 20px', fontWeight: 700 }}
                >
                  🔴 Cerrar Turno de Caja
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
