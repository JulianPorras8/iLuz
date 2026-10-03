import React, { useState, useEffect, useRef } from 'react';

export default function HardwareModal({
  isOpen,
  onClose,
  scannerStatus,
  availablePorts = [],
  currentPort = 'COM3',
  onPortChange,
  onRefreshPorts,
}) {
  const [testScans, setTestScans] = useState([]);
  const [testInput, setTestInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTestScans([]);
      setTestInput('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isConnected = scannerStatus?.connected;
  const statusPort = scannerStatus?.port || currentPort || 'COM3';

  const handleTestSubmit = (e) => {
    e.preventDefault();
    if (!testInput.trim()) return;
    const entry = {
      id: Date.now(),
      code: testInput.trim(),
      time: new Date().toLocaleTimeString('es-CO'),
    };
    setTestScans((prev) => [entry, ...prev.slice(0, 9)]);
    setTestInput('');
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshPorts) await onRefreshPorts();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ maxWidth: '580px', width: '95%' }}>
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔌 Dispositivos y Hardware
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Gestión de escáner de códigos de barras (Honeywell Orbit) y periféricos
            </span>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} style={{ fontSize: '16px' }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '18px' }}>
          {/* Status Banner */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isConnected ? '#ecfdf5' : '#fef2f2',
              border: `2px solid ${isConnected ? '#6ee7b7' : '#fca5a5'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: isConnected ? '#10b981' : '#ef4444',
                  boxShadow: `0 0 10px ${isConnected ? '#10b981' : '#ef4444'}`,
                }}
              />
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', color: isConnected ? '#065f46' : '#991b1b' }}>
                  {isConnected ? `Lector Orbit Conectado en ${statusPort}` : `Lector Desconectado (${statusPort})`}
                </h4>
                <span style={{ fontSize: '12px', color: isConnected ? '#047857' : '#b91c1c' }}>
                  {isConnected
                    ? '9600 Baudios, 8N1 - Escaneos en vivo activos'
                    : scannerStatus?.error || 'Verifica que el cable USB/Serial esté enchufado correctamente.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-clear"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              style={{ fontWeight: 600 }}
            >
              {isRefreshing ? 'Reconectando...' : '🔄 Refrescar'}
            </button>
          </div>

          {/* Port Selector Section */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '18px',
            }}
          >
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Seleccionar Puerto Serial (COM):
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={currentPort}
                onChange={(e) => onPortChange && onPortChange(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontSize: '15px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  fontWeight: 600,
                }}
              >
                {availablePorts.length === 0 ? (
                  <option value="">Sin puertos COM detectados</option>
                ) : (
                  availablePorts.map((p) => (
                    <option key={p} value={p}>
                      {p} {p === currentPort ? '(Actual)' : ''}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleManualRefresh}
                style={{ padding: '10px 16px', fontWeight: 600 }}
              >
                Escanear Puertos
              </button>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'block' }}>
              💡 Si desconectaste el escáner, vuelve a conectarlo y presiona "Escanear Puertos".
            </span>
          </div>

          {/* Live Scanner Testing Console */}
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '14px',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                📟 Consola de Prueba de Lectura
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Pasa un código frente al lector para verificar
              </span>
            </div>

            <form onSubmit={handleTestSubmit} style={{ marginBottom: '10px' }}>
              <input
                ref={inputRef}
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Escanea aquí para probar..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '15px',
                  fontFamily: 'monospace',
                  background: '#1e293b',
                  color: '#4ade80',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                }}
              />
            </form>

            <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
              {testScans.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '10px' }}>
                  Esperando lecturas de prueba...
                </div>
              ) : (
                testScans.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      padding: '4px 6px',
                      borderBottom: '1px solid #1e293b',
                      color: '#a7f3d0',
                    }}
                  >
                    <span>✓ Leído: <strong>{s.code}</strong></span>
                    <span style={{ color: '#64748b' }}>{s.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 18px' }}>
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ padding: '8px 22px' }}>
            Listo / Cerrar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
