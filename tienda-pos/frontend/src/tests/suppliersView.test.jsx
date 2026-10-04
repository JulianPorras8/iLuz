import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuppliersView from '../components/SuppliersView';

describe('SuppliersView - Component & Supplier Catalog Tests', () => {
  const mockSuppliers = [
    {
      id: 1,
      name: 'Distribuidora Alpina',
      nitOrCedula: '890.123.456',
      contactName: 'Carlos Gómez',
      phone: '3119876543',
      paymentTerms: 'Crédito 15 días',
      deliveryDays: 'Martes y Viernes',
      active: true,
    },
    {
      id: 2,
      name: 'Huevos Santa Anita',
      nitOrCedula: '900.654.321',
      contactName: 'Marta Pérez',
      phone: '3201234567',
      paymentTerms: 'Contado',
      deliveryDays: 'Lunes',
      active: false,
    },
  ];

  it('renders suppliers table and filters by text query', () => {
    render(
      <SuppliersView
        suppliers={mockSuppliers}
        onOpenNewSupplier={vi.fn()}
        onEditSupplier={vi.fn()}
        onDeleteSupplier={vi.fn()}
      />
    );

    expect(screen.getByText('Distribuidora Alpina')).toBeDefined();
    expect(screen.getByText('Huevos Santa Anita')).toBeDefined();

    const searchInput = screen.getByPlaceholderText(/Buscar por nombre, NIT/i);
    fireEvent.change(searchInput, { target: { value: 'Alpina' } });

    expect(screen.getByText('Distribuidora Alpina')).toBeDefined();
    expect(screen.queryByText('Huevos Santa Anita')).toBeNull();
  });

  it('triggers onEditSupplier and onDeleteSupplier callbacks', () => {
    const onEditSupplier = vi.fn();
    const onDeleteSupplier = vi.fn();

    render(
      <SuppliersView
        suppliers={mockSuppliers}
        onOpenNewSupplier={vi.fn()}
        onEditSupplier={onEditSupplier}
        onDeleteSupplier={onDeleteSupplier}
      />
    );

    const editButtons = screen.getAllByTitle('Editar');
    fireEvent.click(editButtons[0]);
    expect(onEditSupplier).toHaveBeenCalledWith(mockSuppliers[0]);

    const deleteButtons = screen.getAllByTitle('Desactivar / Eliminar');
    fireEvent.click(deleteButtons[0]);
    expect(onDeleteSupplier).toHaveBeenCalledWith(1);
  });
});
