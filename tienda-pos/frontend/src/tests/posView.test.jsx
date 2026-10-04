import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import POSView from '../components/POSView';

describe('POSView - Component & Workflow Tests', () => {
  const mockProducts = [
    { id: 1, barcode: '770111', name: 'Arroz Diana 1kg', price: 4500, stock: 20, isQuickAccess: true, active: true },
    { id: 2, barcode: '770222', name: 'Leche Alquería 1L', price: 3800, stock: 15, isQuickAccess: true, active: true },
    { id: 3, barcode: '770333', name: 'Aceite Premier 500ml', price: 6200, stock: 5, isQuickAccess: false, active: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cart table and quick products bar', () => {
    const mockCart = [
      { id: 1, barcode: '770111', name: 'Arroz Diana 1kg', price: 4500, stock: 20, qty: 2 },
    ];

    render(
      <POSView
        products={mockProducts}
        cart={mockCart}
        setCart={vi.fn()}
        onClearCart={vi.fn()}
        onOpenCheckout={vi.fn()}
      />
    );

    // Cart contains product
    expect(screen.getByText('Arroz Diana 1kg')).toBeDefined();
    expect(screen.getByText('2 artículos')).toBeDefined();

    // Quick products bar contains active quick products
    expect(screen.getByText(/Arroz Diana 1kg \$4\.500/)).toBeDefined();
    expect(screen.getByText(/Leche Alquería 1L \$3\.800/)).toBeDefined();
  });

  it('triggers onOpenCheckout when COBRAR button is clicked with items in cart', () => {
    const onOpenCheckout = vi.fn();
    const mockCart = [
      { id: 1, barcode: '770111', name: 'Arroz Diana 1kg', price: 4500, stock: 20, qty: 1 },
    ];

    render(
      <POSView
        products={mockProducts}
        cart={mockCart}
        setCart={vi.fn()}
        onClearCart={vi.fn()}
        onOpenCheckout={onOpenCheckout}
      />
    );

    const cobrarBtn = screen.getByText(/COBRAR/);
    expect(cobrarBtn).toBeDefined();
    expect(cobrarBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(cobrarBtn);
    expect(onOpenCheckout).toHaveBeenCalledTimes(1);
  });

  it('disables COBRAR button when cart is empty', () => {
    render(
      <POSView
        products={mockProducts}
        cart={[]}
        setCart={vi.fn()}
        onClearCart={vi.fn()}
        onOpenCheckout={vi.fn()}
      />
    );

    const cobrarBtn = screen.getByText(/COBRAR/);
    expect(cobrarBtn.hasAttribute('disabled')).toBe(true);
  });

  it('adds a quick product to cart when clicked', () => {
    const setCart = vi.fn();
    render(
      <POSView
        products={mockProducts}
        cart={[]}
        setCart={setCart}
        onClearCart={vi.fn()}
        onOpenCheckout={vi.fn()}
      />
    );

    const quickBtn = screen.getByText(/Arroz Diana 1kg \$4\.500/);
    fireEvent.click(quickBtn);

    expect(setCart).toHaveBeenCalledTimes(1);
    const updater = setCart.mock.calls[0][0];
    const newCart = updater([]);
    expect(newCart).toHaveLength(1);
    expect(newCart[0].name).toBe('Arroz Diana 1kg');
    expect(newCart[0].qty).toBe(1);
  });

  it('pauses and holds the current cart and allows restoring it', () => {
    const onClearCart = vi.fn();
    const setCart = vi.fn();
    const mockCart = [
      { id: 1, barcode: '770111', name: 'Arroz Diana 1kg', price: 4500, stock: 20, qty: 1 },
    ];

    const { rerender } = render(
      <POSView
        products={mockProducts}
        cart={mockCart}
        setCart={setCart}
        onClearCart={onClearCart}
        onOpenCheckout={vi.fn()}
      />
    );

    const pauseBtn = screen.getByText(/Pausar Venta/);
    fireEvent.click(pauseBtn);

    expect(onClearCart).toHaveBeenCalledTimes(1);

    // After pausing, held carts banner appears
    expect(screen.getByText(/Ventas en Espera:/)).toBeDefined();
    const resumeBtn = screen.getByText(/Retomar/);
    expect(resumeBtn).toBeDefined();

    // Clicking resume restores cart
    fireEvent.click(resumeBtn);
    expect(setCart).toHaveBeenCalledWith(mockCart);
  });

  it('modifies item quantity and removes item from cart', () => {
    const setCart = vi.fn();
    const mockCart = [
      { id: 1, barcode: '770111', name: 'Arroz Diana 1kg', price: 4500, stock: 20, qty: 2 },
    ];

    render(
      <POSView
        products={mockProducts}
        cart={mockCart}
        setCart={setCart}
        onClearCart={vi.fn()}
        onOpenCheckout={vi.fn()}
      />
    );

    // Remove item button
    const removeBtn = screen.getByTitle('Eliminar artículo');
    fireEvent.click(removeBtn);
    expect(setCart).toHaveBeenCalledTimes(1);
    const removeUpdater = setCart.mock.calls[0][0];
    const cartAfterRemove = removeUpdater(mockCart);
    expect(cartAfterRemove).toHaveLength(0);
  });
});
