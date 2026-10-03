import React, { useState, useEffect } from 'react';
import syncService from '../services/syncService';
import apiAdapter from '../services/apiAdapter';

export default function SettingsModal({
  isOpen,
  onClose,
  currentConfig,
  onSaveConfig,
  onOpenHardwareModal,
}) {
  const [activeTab, setActiveTab] = useState('store'); // 'store', 'rules', 'hardware', 'backup', 'sync'
  const [config, setConfig] = useState({
    storeName: '',
    ownerName: '',
    nitOrCedula: '',
    address: '',
    phone: '',
    receiptFooter: '',
    allowNegativeStock: false,
  });

  const [syncConfig, setSyncConfig] = useState({ serverUrl: '', pairToken: '' });
  const [serverStatus, setServerStatus] = useState(null);

  useEffect(() => {
    if (currentConfig) {
      setConfig({
        ...currentConfig,
        nitOrCedula: currentConfig.nitOrCedula || currentConfig.documentId || '',
      });
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setSyncConfig({ serverUrl: syncService.serverUrl, pairToken: syncService.pairToken });
      if (apiAdapter.isWails) {
         apiAdapter.getSyncServerStatus().then(setServerStatus);
      }
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentConfig, isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveConfig(config);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ maxWidth: '640px', width: '95%' }}>
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚙️ Configuración del Sistema
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Ajustes generales de la tienda, reglas comerciales y base de datos
            </span>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} style={{ fontSize: '16px' }}>
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '4px 16px 0',
            gap: '8px',
          }}
        >
          {[
            { id: 'store', label: '🏪 Datos del Negocio' },
            { id: 'rules', label: '⚙️ Reglas de Venta' },
            { id: 'hardware', label: '🔌 Dispositivos' },
            { id: 'backup', label: '💾 Base de Datos' },
            { id: 'sync', label: '📡 Sincronización en Red Local' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? '#2563eb' : '#64748b',
                background: activeTab === t.id ? 'white' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === t.id ? '#e2e8f0 #e2e8f0 white' : 'transparent',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                marginBottom: '-1px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px', minHeight: '320px' }}>
            {/* TAB 1: DATOS TIENDA */}
            {activeTab === 'store' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Nombre de la Tienda (*):
                    </label>
                    <input
                      name="storeName"
                      required
                      value={config.storeName || ''}
                      onChange={handleChange}
                      placeholder="Ej: Tienda Don Lucho"
                      style={{ fontSize: '14px', padding: '8px 12px' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Propietario / Responsable:
                    </label>
                    <input
                      name="ownerName"
                      value={config.ownerName || ''}
                      onChange={handleChange}
                      placeholder="Ej: Luis Carlos Pérez"
                      style={{ fontSize: '14px', padding: '8px 12px' }}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Cédula / NIT:
                    </label>
                    <input
                      name="nitOrCedula"
                      value={config.nitOrCedula || ''}
                      onChange={handleChange}
                      placeholder="Ej: 1020304050-1"
                      style={{ fontSize: '14px', padding: '8px 12px' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Teléfono / WhatsApp:
                    </label>
                    <input
                      name="phone"
                      value={config.phone || ''}
                      onChange={handleChange}
                      placeholder="Ej: 310 123 4567"
                      style={{ fontSize: '14px', padding: '8px 12px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Dirección Física:
                  </label>
                  <input
                    name="address"
                    value={config.address || ''}
                    onChange={handleChange}
                    placeholder="Ej: Calle 45 # 12-34, Barrio San José"
                    style={{ fontSize: '14px', padding: '8px 12px' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Pie de Página del Comprobante:
                  </label>
                  <textarea
                    rows={2}
                    name="receiptFooter"
                    value={config.receiptFooter || ''}
                    onChange={handleChange}
                    placeholder="¡Gracias por su compra! Vuelva pronto."
                    style={{ fontSize: '13px', padding: '8px 12px' }}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: REGLAS DE VENTA */}
            {activeTab === 'rules' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '14px',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="allowNegativeStock"
                      checked={config.allowNegativeStock || false}
                      onChange={handleChange}
                      style={{ width: '18px', height: '18px', marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '14px', color: '#166534', display: 'block' }}>
                        Permitir ventas con stock en cero o temporalmente negativo (-1, -2)
                      </strong>
                      <span style={{ fontSize: '12px', color: '#15803d' }}>
                        Ideal para no frenar la venta en caja si acaba de llegar mercancía a estantería que aún no ha sido registrada.
                      </span>
                    </div>
                  </label>
                </div>

                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '14px',
                    fontSize: '12px',
                    color: '#1e40af',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>⚖️ Marco Tributario Colombia (Persona Natural No Responsable de IVA):</strong>
                  <p style={{ margin: '4px 0 0' }}>
                    Los tiquetes emitidos se denominan legalmente <em>"Comprobante de Venta Interno"</em> bajo el Art. 616-2 del Estatuto Tributario (&lt; 3.500 UVT/año).
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: HARDWARE & DISPOSITIVOS */}
            {activeTab === 'hardware' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <h4 style={{ margin: '0 0 6px', fontSize: '14px', color: '#0f172a' }}>
                    Lector de Códigos de Barras (Honeywell Orbit)
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px' }}>
                    Gestiona los puertos COM, velocidad de baudios y consola de lectura en vivo.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      onClose();
                      if (onOpenHardwareModal) onOpenHardwareModal();
                    }}
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    🔌 Abrir Panel de Dispositivos y Escáner
                  </button>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <h4 style={{ margin: '0 0 6px', fontSize: '14px', color: '#0f172a' }}>
                    Impresora Térmica de Tiquetes
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                    Formato estándar compatible con rollos térmicos de 58mm y 80mm ESC/POS mediante el diálogo de impresión de Windows.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: BASE DE DATOS Y RESPALDO */}
            {activeTab === 'backup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <h4 style={{ margin: '0 0 6px', fontSize: '14px', color: '#0f172a' }}>
                    💾 Base de Datos Local SQLite
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px', lineHeight: 1.5 }}>
                    Toda la información de productos, ventas, turnos de caja y compras se almacena en el archivo local protegido en la máquina.
                  </p>
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: '#334155',
                      marginBottom: '12px',
                    }}
                  >
                    tienda.db (Modo WAL de alta concurrencia activo)
                  </div>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                    ✓ Integridad transaccional verificada
                  </span>
                </div>
              </div>
            )}
            {/* TAB 5: SYNC */}
            {activeTab === 'sync' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <h4 style={{ margin: '0 0 6px', fontSize: '14px', color: '#0f172a' }}>
                    📡 Sincronización en Red Local (LAN)
                  </h4>
                  {apiAdapter.isWails ? (
                     <div>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px' }}>
                          Este PC funciona como servidor. Para conectar dispositivos Sunmi u otros navegadores, ingresa estos datos:
                        </p>
                        <div style={{ padding: '10px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '8px', fontFamily: 'monospace' }}>
                           <strong>IP del Servidor:</strong> {serverStatus?.serverUrl || 'Cargando...'}
                        </div>
                        <div style={{ padding: '10px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '8px', fontFamily: 'monospace' }}>
                           <strong>Código de Emparejamiento:</strong> {serverStatus?.pairToken || 'Cargando...'}
                           <button type="button" onClick={() => navigator.clipboard.writeText(serverStatus?.pairToken)} style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>Copiar</button>
                        </div>
                        <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
                           🟢 Servidor LAN Escuchando en el puerto 8085
                        </div>
                     </div>
                  ) : (
                     <div>
                        <div className="form-group">
                           <label style={{ fontSize: '12px', fontWeight: 600 }}>IP del PC Servidor (ej. http://192.168.1.50:8085)</label>
                           <input
                             type="text"
                             value={syncConfig.serverUrl}
                             onChange={(e) => setSyncConfig({...syncConfig, serverUrl: e.target.value})}
                             placeholder="http://192.168.1.x:8085"
                             style={{ padding: '8px', width: '100%', marginBottom: '10px' }}
                           />
                        </div>
                        <div className="form-group">
                           <label style={{ fontSize: '12px', fontWeight: 600 }}>Código de Emparejamiento</label>
                           <input
                             type="text"
                             value={syncConfig.pairToken}
                             onChange={(e) => setSyncConfig({...syncConfig, pairToken: e.target.value})}
                             placeholder="Código del servidor"
                             style={{ padding: '8px', width: '100%', marginBottom: '10px' }}
                           />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                           <button 
                             type="button" 
                             className="btn btn-secondary" 
                             onClick={async () => {
                               syncService.setServerConfig(syncConfig.serverUrl, syncConfig.pairToken);
                               const res = await syncService.checkConnection();
                               if (res.isOnline) {
                                  alert(`Conexión exitosa. Tienda: ${res.storeName}`);
                               } else {
                                  alert('No se pudo conectar al servidor. Verifica la IP y el código.');
                               }
                             }}
                             style={{ padding: '8px 12px' }}>
                             🔍 Probar Conexión
                           </button>
                           <button 
                             type="button" 
                             className="btn btn-primary" 
                             onClick={async () => {
                               syncService.setServerConfig(syncConfig.serverUrl, syncConfig.pairToken);
                               const success = await syncService.syncNow();
                               if (success) {
                                 alert('Sincronización completada');
                               } else {
                                 alert('Error en la sincronización');
                               }
                             }}
                             style={{ padding: '8px 12px' }}>
                             🔄 Sincronizar Ahora
                           </button>
                        </div>
                     </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="modal-footer"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>iLuz v3.0 POS</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-clear" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: '#2563eb', padding: '9px 24px', fontWeight: 700 }}
              >
                ✓ Guardar Configuración
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
