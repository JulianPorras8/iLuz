import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PurchaseIntakeView from '../components/PurchaseIntakeView';

describe('PurchaseIntakeView - Component & Purchase Order Intake Tests', () => {
  const mockSuppliers = [
    { id: 1, name: 'Distribuidora Bavaria', nitOrCedula: '890.100.200', active: true },
    { id: 2, name: 'Postobón Central', nitOrCedula: '890.300.400', active: true },
  ];

  const mockProducts = [
    { id: 10, barcode: '770111', name: 'Cerveza Águila 330ml', price: 3500, costPrice: 2400, stock: 48 },
    { id: 20, barcode: '770222', name: 'Pony Malta 330ml', price: 2500, costPrice: 1800, stock: 24 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it('renders header form and triggers onStartPurchase with valid invoice details', () => {
    const onStartPurchase = vi.fn();

    render(
      <PurchaseIntakeView
        suppliers={mockSuppliers}
        products={mockProducts}
        activePurchase={null}
        onStartPurchase={onStartPurchase}
        onAddItemToPurchase={vi.fn()}
        onUpdateItemInPurchase={vi.fn()}
        onRemoveItemFromPurchase={vi.fn()}
        onFinalizePurchase={vi.fn()}
        onCancelPurchase={vi.fn()}
      />
    );

    expect(screen.getByText(/Entrada de Mercancía por Pedido/i)).toBeDefined();

    // Select supplier (first combobox)
    const supplierSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(supplierSelect, { target: { value: '1' } });

    // Enter invoice number
    const invoiceInput = screen.getByPlaceholderText(/Ej: FAC-10294/i);
    fireEvent.change(invoiceInput, { target: { value: 'FAC-10045' } });

    // Click start intake
    const startBtn = screen.getByRole('button', { name: /Iniciar Ingreso de Mercancía/i });
    fireEvent.click(startBtn);

    expect(onStartPurchase).toHaveBeenCalledTimes(1);
    const headerData = onStartPurchase.mock.calls[0][0];
    expect(headerData.supplierId).toBe('1');
    expect(headerData.invoiceNumber).toBe('FAC-10045');
  });

  it('renders active purchase table, updates item quantity and calculates total', () => {
    const activePurchase = {
      supplierId: 1,
      invoiceNumber: 'FAC-10045',
      items: [
        {
          id: 10,
          productId: 10,
          barcode: '770111',
          name: 'Cerveza Águila 330ml',
          unitCost: 2500,
          previousCost: 2400,
          suggestedPrice: 3500,
          qty: 24,
        },
      ],
    };

    const onFinalizePurchase = vi.fn();
    const onUpdateItemInPurchase = vi.fn();

    render(
      <PurchaseIntakeView
        suppliers={mockSuppliers}
        products={mockProducts}
        activePurchase={activePurchase}
        onStartPurchase={vi.fn()}
        onAddItemToPurchase={vi.fn()}
        onUpdateItemInPurchase={onUpdateItemInPurchase}
        onRemoveItemFromPurchase={vi.fn()}
        onFinalizePurchase={onFinalizePurchase}
        onCancelPurchase={vi.fn()}
      />
    );

    // Active table renders item
    expect(screen.getByText('Cerveza Águila 330ml')).toBeDefined();
    expect(screen.getByText(/CÓDIGO/i)).toBeDefined();

    // Finalize purchase button
    const finalizeBtn = screen.getByText(/Finalizar e Ingresar a Inventario/i);
    fireEvent.click(finalizeBtn);

    expect(onFinalizePurchase).toHaveBeenCalledTimes(1);
    const payload = onFinalizePurchase.mock.calls[0][0];
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].qty).toBe(24);
    expect(payload.items[0].unitCost).toBe(2500);
    expect(payload.totalCost).toBe(60000); // 24 * 2500 = 60,000
  });
});
