import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductModal from '../components/ProductModal';

describe('ProductModal - Component & Form Submission Tests', () => {
  const mockLocations = [
    { id: 1, code: 'EST01-N1', name: 'Estante 1 Nivel 1' },
    { id: 2, code: 'NEV01', name: 'Nevera Lácteos' },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders blank form for creating new product and sets quick access checkbox', () => {
    render(
      <ProductModal
        isOpen={true}
        product={null}
        locations={mockLocations}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Nuevo Producto')).toBeDefined();
    expect(screen.getByLabelText(/Nombre del Producto/i)).toBeDefined();
    expect(screen.getByLabelText(/Precio de Venta/i)).toBeDefined();

    // Quick access checkbox
    const quickAccessCheckbox = screen.getByLabelText(/Producto de acceso rápido/i);
    expect(quickAccessCheckbox).toBeDefined();
    expect(quickAccessCheckbox.checked).toBe(false);
  });

  it('submits valid new product data with isQuickAccess enabled', () => {
    const onSave = vi.fn();
    render(
      <ProductModal
        isOpen={true}
        product={null}
        locations={mockLocations}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    // Fill form
    fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), { target: { value: 'Huevos AA x30' } });
    fireEvent.change(screen.getByLabelText(/Precio de Venta/i), { target: { value: '18000' } });
    fireEvent.change(screen.getByLabelText(/Precio de Costo/i), { target: { value: '14500' } });
    fireEvent.change(screen.getByLabelText(/Stock Actual/i), { target: { value: '25' } });

    // Check quick access
    const quickAccessCheckbox = screen.getByLabelText(/Producto de acceso rápido/i);
    fireEvent.click(quickAccessCheckbox);

    // Save
    const saveBtn = screen.getByText('Guardar Producto');
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedProd = onSave.mock.calls[0][0];
    expect(savedProd.name).toBe('Huevos AA x30');
    expect(savedProd.price).toBe(18000);
    expect(savedProd.costPrice).toBe(14500);
    expect(savedProd.stock).toBe(25);
    expect(savedProd.isQuickAccess).toBe(true);
    expect(savedProd.active).toBe(true);
  });

  it('renders existing product in edit mode and preserves id', () => {
    const existing = {
      id: 42,
      barcode: '770999',
      name: 'Café Sello Rojo 500g',
      costPrice: 9000,
      price: 12500,
      stock: 12,
      location: 'EST01-N1',
      unitOfMeasure: 'g',
      weight: 500,
      active: true,
      isQuickAccess: true,
    };

    const onSave = vi.fn();
    render(
      <ProductModal
        isOpen={true}
        product={existing}
        locations={mockLocations}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Editar Producto')).toBeDefined();
    const nameInput = screen.getByLabelText(/Nombre del Producto/i);
    expect(nameInput.value).toBe('Café Sello Rojo 500g');

    // Edit price
    fireEvent.change(screen.getByLabelText(/Precio de Venta/i), { target: { value: '13000' } });

    // Save
    const saveBtn = screen.getByText('Guardar Producto');
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const updated = onSave.mock.calls[0][0];
    expect(updated.id).toBe(42);
    expect(updated.barcode).toBe('770999');
    expect(updated.price).toBe(13000);
  });
});
