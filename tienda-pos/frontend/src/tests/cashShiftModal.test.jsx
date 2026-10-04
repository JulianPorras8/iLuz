import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CashShiftModal from '../components/CashShiftModal';

describe('CashShiftModal - Component & Shift Lifecycle Tests', () => {
  it('renders shift opening form and triggers onOpenShift', () => {
    const onOpenShift = vi.fn();

    render(
      <CashShiftModal
        isOpen={true}
        onClose={vi.fn()}
        currentShift={null}
        storeConfig={{ ownerName: 'Don Julián' }}
        onOpenShift={onOpenShift}
        onCloseShift={vi.fn()}
      />
    );

    expect(screen.getByText(/Apertura de Turno de Caja/i)).toBeDefined();

    // Select $100.000 quick preset button
    const presetBtn = screen.getByText('$100.000');
    fireEvent.click(presetBtn);

    // Click submit
    const openBtn = screen.getByText(/Abrir Turno de Caja/i);
    fireEvent.click(openBtn);

    expect(onOpenShift).toHaveBeenCalledTimes(1);
    expect(onOpenShift).toHaveBeenCalledWith(100000, expect.stringContaining('Responsable: Don Julián'));
  });

  it('renders active shift, performs blind cash count and handles difference assimilation', () => {
    const activeShift = {
      id: 55,
      openedAt: '2026-10-03 08:00:00',
      initialCash: 50000,
      expectedCash: 120000,
      status: 'open',
    };

    const onCloseShift = vi.fn();

    render(
      <CashShiftModal
        isOpen={true}
        onClose={vi.fn()}
        currentShift={activeShift}
        storeConfig={{ ownerName: 'Don Julián' }}
        onOpenShift={vi.fn()}
        onCloseShift={onCloseShift}
      />
    );

    expect(screen.getByText(/Cierre y Arqueo de Turno #55/i)).toBeDefined();

    // Blind cash count entry
    const countInput = screen.getByPlaceholderText(/Digita el dinero real en caja/i);
    fireEvent.change(countInput, { target: { value: '125000' } });

    // Difference assimilation button should appear (Art. 616 E.T.)
    const assimilateBtn = screen.getByText(/Asimilando Sobrante/i);
    expect(assimilateBtn).toBeDefined();

    // Click assimilate button
    fireEvent.click(assimilateBtn);

    expect(onCloseShift).toHaveBeenCalledTimes(1);
    expect(onCloseShift).toHaveBeenCalledWith(
      55,
      125000,
      true, // assimilateDifference = true
      expect.anything()
    );
  });
});
