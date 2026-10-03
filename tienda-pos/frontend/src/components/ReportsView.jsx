import React, { useState, useEffect } from 'react';
import syncService from '../services/syncService';

export default function ReportsView({ reportData, onFetchReport, onExportReportCSV }) {
  const [period, setPeriod] = useState('week'); // week, month, year
  const [lastSyncTime, setLastSyncTime] = useState(syncService.lastSyncTimestamp);

  useEffect(() => {
    if (onFetchReport) {
      onFetchReport(period);
    }
  }, [period, onFetchReport]);
  
  useEffect(() => {
    const handleSyncStatus = (e) => {
      if (e.detail.lastSyncTime) setLastSyncTime(e.detail.lastSyncTime);
    };
    window.addEventListener('sync-status-changed', handleSyncStatus);
    return () => window.removeEventListener('sync-status-changed', handleSyncStatus);
  }, []);

  const data = reportData || {};
  const totalSalesAmount = data.totalSalesAmount ?? data.totalSales ?? 0;
  const totalSalesCount = data.totalSalesCount ?? data.salesCount ?? 0;
  const averageTicket = data.averageTicket || (totalSalesCount > 0 ? totalSalesAmount / totalSalesCount : 0);

  const totalPurchasesAmount = data.totalPurchasesAmount ?? data.totalPurchases ?? 0;
  const totalPurchasesCount = data.totalPurchasesCount ?? data.purchasesCount ?? 0;

  const grossMargin = data.grossMargin ?? (totalSalesAmount - totalPurchasesAmount);
  const marginPercentage = data.grossMarginPct ?? (totalSalesAmount > 0 ? (grossMargin / totalSalesAmount) * 100 : 0);

  // DIAN UVT Limit for Non-Responsible IVA Person
  const DIAN_LIMIT_COP = data.dianUvtThreshold || 174296500; // 3500 UVT approx
  const currentYearSales = data.annualSalesAccumulated || totalSalesAmount;
  const dianPercentage = data.dianCurrentPct !== undefined ? data.dianCurrentPct : Math.min((currentYearSales / DIAN_LIMIT_COP) * 100, 100);
  
  let dianColor = '#10b981'; // green
  if (dianPercentage >= 90) dianColor = '#ef4444'; // red
  else if (dianPercentage >= 70) dianColor = '#f59e0b'; // amber

  const paymentMethods = data.paymentMethods || {
    cash: 0,
    transfer: 0,
    credit: 0
  };

  const topProducts = data.topProducts || [];

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      {/* Header & Period Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
           <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px 0' }}>Reportes Financieros y Comerciales</h2>
           <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>🕒 Datos consolidados al: {lastSyncTime ? new Date(parseInt(lastSyncTime)).toLocaleString() : 'Tiempo Real'}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
          {['week', 'month', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: period === p ? '#fff' : 'transparent',
                color: period === p ? '#0f172a' : '#64748b',
                fontWeight: period === p ? 'bold' : 'normal',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px'
              }}
            >
              {p === 'week' ? 'Esta Semana' : p === 'month' ? 'Este Mes' : 'Este Año'}
            </button>
          ))}
        </div>
        
        <button 
          onClick={() => onExportReportCSV && onExportReportCSV(period)}
          style={{
            padding: '10px 20px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          📥 Exportar a CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* Ventas */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            💰 Total Ventas
          </h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>
            {formatCurrency(totalSalesAmount)}
          </div>
          <div style={{ fontSize: '14px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
            <span>{totalSalesCount} transacciones</span>
            <span>Ticket prom: {formatCurrency(averageTicket)}</span>
          </div>
        </div>

        {/* Compras */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            📦 Total Compras a Proveedores
          </h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>
            {formatCurrency(totalPurchasesAmount)}
          </div>
          <div style={{ fontSize: '14px', color: '#475569' }}>
            <span>{totalPurchasesCount} facturas ingresadas</span>
          </div>
        </div>

        {/* Margen */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            📈 Margen Bruto Estimado
          </h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: grossMargin >= 0 ? '#059669' : '#ef4444', marginBottom: '8px' }}>
            {formatCurrency(grossMargin)}
          </div>
          <div style={{ fontSize: '14px', color: '#475569' }}>
            <span>{marginPercentage.toFixed(1)}% de rentabilidad sobre ventas</span>
          </div>
        </div>

        {/* Tope DIAN */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            ⚖️ Medidor de Tope DIAN
          </h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
            {formatCurrency(currentYearSales)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
            Límite anual (3.500 UVT): {formatCurrency(DIAN_LIMIT_COP)}
          </div>
          
          <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${dianPercentage}%`, height: '100%', background: dianColor, transition: 'width 0.5s ease' }}></div>
          </div>
          <div style={{ fontSize: '12px', color: dianColor, marginTop: '8px', textAlign: 'right', fontWeight: 'bold' }}>
            {dianPercentage.toFixed(1)}% del límite
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Payment Methods Breakdown */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px', margin: '0 0 20px 0' }}>Desglose de Métodos de Pago</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>💵</div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>Efectivo en gaveta</div>
                </div>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>{formatCurrency(paymentMethods.cash)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>📱</div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>Transferencias electrónicas</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Nequi / Daviplata / Bancolombia</div>
                </div>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>{formatCurrency(paymentMethods.transfer)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>📝</div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>Ventas a crédito</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Fiao por cobrar</div>
                </div>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>{formatCurrency(paymentMethods.credit)}</div>
            </div>
          </div>
        </div>

        {/* Top 10 Products Table */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px', margin: '0 0 20px 0' }}>Top 10 Productos Más Vendidos</h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: '600', fontSize: '14px' }}>#</th>
                  <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: '600', fontSize: '14px' }}>Producto</th>
                  <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: '600', fontSize: '14px', textAlign: 'right' }}>Cantidad</th>
                  <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: '600', fontSize: '14px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length > 0 ? (
                  topProducts.map((prod, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#94a3b8', fontSize: '14px' }}>{index + 1}</td>
                      <td style={{ padding: '12px 8px', fontWeight: '500', color: '#0f172a', fontSize: '14px' }}>{prod.name}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '14px' }}>{prod.quantity}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#059669', fontSize: '14px' }}>
                        {formatCurrency(prod.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                      No hay datos de ventas para este período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
