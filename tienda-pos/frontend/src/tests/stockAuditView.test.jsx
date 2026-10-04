import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StockAuditView from '../components/StockAuditView';
import StartAuditModal from '../components/StartAuditModal';
import AuditReconciliationModal from '../components/AuditReconciliationModal';

describe('StockAuditView & Audit Modals - Physical Inventory Lifecycle Tests', () => {
  it('renders empty state when no session is active and triggers onStartSession', () => {
    const onStartSession = vi.fn();

    render(
      <StockAuditView
        session={null}
        items={[]}
        completedSessions={[]}
        locations={[]}
        activeLocationCode="EST01"
        setActiveLocationCode={vi.fn()}
        onStartSession={onStartSession}
        onOpenFinishAudit={vi.fn()}
        onCancelSession={vi.fn()}
        onRecordScan={vi.fn()}
        onBatchCount={vi.fn()}
        onUndoLastCount={vi.fn()}
        onExportSessionCSV={vi.fn()}
      />
    );

    expect(screen.getByText(/Toma de Inventario Físico/i)).toBeDefined();

    const startBtn = screen.getByText(/Iniciar Nueva Toma de Inventario/i);
    fireEvent.click(startBtn);

    expect(onStartSession).toHaveBeenCalledTimes(1);
  });

  it('renders StartAuditModal and starts session with shelf selection', () => {
    const onStart = vi.fn();
    const mockShelves = [
      { id: 1, code: 'EST01', name: 'Estantería 1' },
      { id: 2, code: 'EST02', name: 'Estantería 2' },
    ];

    render(
      <StartAuditModal
        isOpen={true}
        shelves={mockShelves}
        locations={[]}
        onStart={onStart}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Iniciar Nueva Toma de Inventario/i)).toBeDefined();

    // Select shelves scope
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'SHELVES' } });

    // Check EST01
    const est01Checkbox = screen.getByLabelText(/EST01 - Estantería 1/i);
    fireEvent.click(est01Checkbox);

    // Fill responsible
    const respInput = screen.getByPlaceholderText(/Nombre de quien realiza el conteo/i);
    fireEvent.change(respInput, { target: { value: 'Auditor Carlos' } });

    // Submit
    const submitBtn = screen.getByText(/Iniciar Inventario/i);
    fireEvent.click(submitBtn);

    expect(onStart).toHaveBeenCalledTimes(1);
    const startData = onStart.mock.calls[0][0];
    expect(startData.scope).toBe('EST01');
    expect(startData.responsible).toBe('Auditor Carlos');
  });

  it('renders active audit session and triggers finish reconciliation modal', () => {
    const activeSession = {
      id: 99,
      name: 'Toma General Quincenal',
      responsible: 'Carlos',
      scope: 'ALL',
      status: 'active',
      startedAt: '2026-10-03 10:00:00',
    };

    const mockItems = [
      {
        id: 1,
        barcode: '770111',
        productName: 'Arroz Diana 1kg',
        systemStock: 10,
        countedStock: 8,
        isCounted: true,
        variance: -2,
      },
    ];

    const onOpenFinishAudit = vi.fn();

    render(
      <StockAuditView
        session={activeSession}
        items={mockItems}
        completedSessions={[]}
        locations={[]}
        activeLocationCode="EST01"
        setActiveLocationCode={vi.fn()}
        onStartSession={vi.fn()}
        onOpenFinishAudit={onOpenFinishAudit}
        onCancelSession={vi.fn()}
        onRecordScan={vi.fn()}
        onBatchCount={vi.fn()}
        onUndoLastCount={vi.fn()}
        onExportSessionCSV={vi.fn()}
      />
    );

    expect(screen.getByText('Toma General Quincenal')).toBeDefined();
    expect(screen.getByText('Arroz Diana 1kg')).toBeDefined();

    // Finish audit button
    const finishBtn = screen.getByText(/Finalizar Inventario/i);
    fireEvent.click(finishBtn);

    expect(onOpenFinishAudit).toHaveBeenCalledTimes(1);
  });

  it('renders AuditReconciliationModal and confirms adjustment', () => {
    const activeSession = {
      id: 99,
      name: 'Toma General Quincenal',
      scope: 'ALL',
    };

    const mockItems = [
      {
        id: 1,
        productId: 10,
        barcode: '770111',
        productName: 'Arroz Diana 1kg',
        systemStock: 10,
        countedStock: 8,
        isCounted: true,
        variance: -2,
        difference: -5000,
        locationCode: 'EST01',
      },
    ];

    const onConfirmClose = vi.fn();

    render(
      <AuditReconciliationModal
        isOpen={true}
        session={activeSession}
        items={mockItems}
        onConfirmClose={onConfirmClose}
        onClose={vi.fn()}
        onExportCSV={vi.fn()}
      />
    );

    expect(screen.getByText(/Finalizar Toma de Inventario/i)).toBeDefined();
    expect(screen.getByText('Arroz Diana 1kg')).toBeDefined();

    // Confirm close adjustments
    const confirmBtn = screen.getByText(/Finalizar \(1 ajustes\)/i);
    fireEvent.click(confirmBtn);

    expect(onConfirmClose).toHaveBeenCalledTimes(1);
    expect(onConfirmClose).toHaveBeenCalledWith([10]);
  });
});
