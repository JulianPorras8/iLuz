import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutModal from '../components/CheckoutModal';

describe('CheckoutModal - Component & Payment Workflow Tests', () => {
  const mockCart = [
    { id: 1, barcode: '770111', name: 'Arroz Diana', price: 4000, costPrice: 3000, stock: 10, qty: 2 },
    { id: 2, barcode: '770222', name: 'Leche Alquería', price: 3500, costPrice: 2800, stock: 5, qty: 1 },
  ];
  const totalAmount = 11500; // (4000 * 2) + 3500 = 11500

  beforeEach(() => {
    delete window.go;
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders total amount and payment method buttons correctly', () => {
    render(
      <CheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        totalAmount={totalAmount}
        onCompleteSale={vi.fn()}
      />
    );

    // Total display
    expect(screen.getByText(/Total a Cobrar/i)).toBeDefined();
    expect(screen.getByText(/\$11\.500/)).toBeDefined();

    // Payment options
    expect(screen.getAllByText(/Efectivo/i)[0]).toBeDefined();
    expect(screen.getByText(/Transf/i)).toBeDefined();
    expect(screen.getByText(/Tarjeta/i)).toBeDefined();
    expect(screen.getByText(/Fiao/i)).toBeDefined();
  });

  it('calculates change due correctly for cash payment', () => {
    render(
      <CheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        totalAmount={totalAmount}
        onCompleteSale={vi.fn()}
      />
    );

    const paidInput = screen.getByRole('spinbutton');
    fireEvent.change(paidInput, { target: { value: '20000' } });

    // Change should be 20,000 - 11,500 = 8,500
    expect(screen.getByText(/CAMBIO \/ DEVUELTA/i)).toBeDefined();
    expect(screen.getByText(/\$8\.500/)).toBeDefined();
  });

  it('submits completed sale with cash payment details', async () => {
    const onCompleteSale = vi.fn().mockResolvedValue({ id: 1, ticketNumber: 'REM-001' });

    render(
      <CheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        totalAmount={totalAmount}
        onCompleteSale={onCompleteSale}
      />
    );

    const paidInput = screen.getByRole('spinbutton');
    fireEvent.change(paidInput, { target: { value: '15000' } });

    const submitBtn = screen.getByText(/Confirmar y Cobrar/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCompleteSale).toHaveBeenCalledTimes(1);
    });

    const [salePayload, printReceipt] = onCompleteSale.mock.calls[0];
    expect(salePayload.paymentMethod).toBe('cash');
    expect(salePayload.amountPaid).toBe(15000);
    expect(salePayload.changeDue).toBe(3500);
    expect(salePayload.items).toHaveLength(2);
    expect(salePayload.items[0].productName).toBe('Arroz Diana');
    expect(salePayload.items[0].qty).toBe(2);
    expect(printReceipt).toBe(true);
  });

  it('submits electronic transfer sale without requiring excess cash', async () => {
    const onCompleteSale = vi.fn().mockResolvedValue({ id: 2, ticketNumber: 'REM-002' });

    render(
      <CheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        totalAmount={totalAmount}
        onCompleteSale={onCompleteSale}
      />
    );

    // Click transfer tab
    const transferBtn = screen.getByText(/Transf/i);
    fireEvent.click(transferBtn);

    const submitBtn = screen.getByText(/Confirmar y Cobrar/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCompleteSale).toHaveBeenCalledTimes(1);
    });

    const [salePayload] = onCompleteSale.mock.calls[0];
    expect(salePayload.paymentMethod).toBe('transfer');
    expect(salePayload.amountPaid).toBe(totalAmount);
    expect(salePayload.changeDue).toBe(0);
  });

  it('validates customer name when choosing credit (Fiao)', async () => {
    window.alert = vi.fn();
    const onCompleteSale = vi.fn();

    render(
      <CheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        totalAmount={totalAmount}
        onCompleteSale={onCompleteSale}
      />
    );

    // Select Fiao tab
    const fiaoBtn = screen.getByText(/Fiao/i);
    fireEvent.click(fiaoBtn);

    // Attempt submit with default 'Cliente de Mostrador'
    const submitBtn = screen.getByText(/Confirmar y Cobrar/i);
    fireEvent.click(submitBtn);

    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Para ventas a crédito (Fiao), debes ingresar o seleccionar el nombre del cliente.')
    );
    expect(onCompleteSale).not.toHaveBeenCalled();
  });
});
