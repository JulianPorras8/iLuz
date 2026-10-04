import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportsView from '../components/ReportsView';

describe('ReportsView - Financial Metrics & DIAN Limit Tests', () => {
  const mockReportData = {
    period: 'month',
    totalSales: 45000000,
    salesCount: 120,
    averageTicket: 375000,
    totalPurchases: 32000000,
    purchasesCount: 15,
    grossMargin: 13000000,
    grossMarginPct: 28.8,
    dianUvtThreshold: 174296500,
    dianCurrentPct: 25.8,
    paymentMethods: {
      cash: 30000000,
      transfer: 12000000,
      credit: 3000000,
    },
    topProducts: [
      { name: 'Arroz Diana', totalQty: 450, totalSales: 2025000 },
      { name: 'Leche Alquería', totalQty: 300, totalSales: 1140000 },
    ],
  };

  it('renders KPI metric cards and switches time periods', () => {
    const onFetchReport = vi.fn();

    render(
      <ReportsView
        reportData={mockReportData}
        onFetchReport={onFetchReport}
        onExportReportCSV={vi.fn()}
      />
    );

    expect(screen.getByText(/Reportes Financieros y Comerciales/i)).toBeDefined();

    // Check sales card
    expect(screen.getByText(/Total Ventas/i)).toBeDefined();

    // Check purchases and margin
    expect(screen.getByText(/Total Compras a Proveedores/i)).toBeDefined();
    expect(screen.getByText(/Margen Bruto Estimado/i)).toBeDefined();

    // Switch period to 'Este Año'
    const yearBtn = screen.getByText('Este Año');
    fireEvent.click(yearBtn);

    expect(onFetchReport).toHaveBeenCalledWith('year');
  });

  it('displays the DIAN 3,500 UVT limit gauge and triggers CSV export', () => {
    const onExportReportCSV = vi.fn();

    render(
      <ReportsView
        reportData={mockReportData}
        onFetchReport={vi.fn()}
        onExportReportCSV={onExportReportCSV}
      />
    );

    // DIAN UVT Limit bar
    expect(screen.getByText(/Medidor de Tope DIAN/i)).toBeDefined();
    expect(screen.getByText(/25\.8% del límite/i)).toBeDefined();

    // Export CSV button
    const exportBtn = screen.getByText(/Exportar a CSV/i);
    fireEvent.click(exportBtn);

    expect(onExportReportCSV).toHaveBeenCalledWith('week'); // Default period
  });
});
