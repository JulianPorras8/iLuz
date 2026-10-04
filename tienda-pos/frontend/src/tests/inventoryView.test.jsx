import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InventoryView from '../components/InventoryView';

describe('InventoryView - Component & Catalog Navigation Tests', () => {
  const mockProducts = [
    { id: 1, barcode: '770111', name: 'Arroz Diana 1kg', price: 4500, costPrice: 3200, stock: 25, active: true, location: 'EST01' },
    { id: 2, barcode: '770222', name: 'Leche Colanta 1L', price: 3900, costPrice: 2900, stock: 10, active: true, location: 'NEV01' },
    { id: 3, barcode: '770333', name: 'Pan Tajado Bimbo', price: 6500, costPrice: 4800, stock: 0, active: false, location: 'EST02' },
  ];

  it('renders products table and filters by search query', () => {
    render(
      <InventoryView
        products={mockProducts}
        onOpenNewProduct={vi.fn()}
        onEditProduct={vi.fn()}
        onToggleActive={vi.fn()}
        onExportCSV={vi.fn()}
      />
    );

    // Initial table has active products (Arroz Diana and Leche Colanta)
    expect(screen.getByText('Arroz Diana 1kg')).toBeDefined();
    expect(screen.getByText('Leche Colanta 1L')).toBeDefined();

    // Search query filter
    const searchInput = screen.getByPlaceholderText(/Filtrar por nombre/i);
    fireEvent.change(searchInput, { target: { value: 'Colanta' } });

    expect(screen.queryByText('Arroz Diana 1kg')).toBeNull();
    expect(screen.getByText('Leche Colanta 1L')).toBeDefined();
  });

  it('filters by status (active vs archived)', () => {
    render(
      <InventoryView
        products={mockProducts}
        onOpenNewProduct={vi.fn()}
        onEditProduct={vi.fn()}
        onToggleActive={vi.fn()}
        onExportCSV={vi.fn()}
      />
    );

    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'archived' } });

    // Should now show Pan Tajado Bimbo which is inactive
    expect(screen.getByText('Pan Tajado Bimbo')).toBeDefined();
    expect(screen.queryByText('Arroz Diana 1kg')).toBeNull();
  });

  it('triggers onEditProduct when clicking edit button', () => {
    const onEditProduct = vi.fn();
    render(
      <InventoryView
        products={mockProducts}
        onOpenNewProduct={vi.fn()}
        onEditProduct={onEditProduct}
        onToggleActive={vi.fn()}
        onExportCSV={vi.fn()}
      />
    );

    const editButtons = screen.getAllByTitle(/Editar Producto/i);
    fireEvent.click(editButtons[0]);

    expect(onEditProduct).toHaveBeenCalledWith(mockProducts[0]);
  });

  it('triggers onExportCSV when clicking Export CSV button', () => {
    const onExportCSV = vi.fn();
    render(
      <InventoryView
        products={mockProducts}
        onOpenNewProduct={vi.fn()}
        onEditProduct={vi.fn()}
        onToggleActive={vi.fn()}
        onExportCSV={onExportCSV}
      />
    );

    const exportBtn = screen.getByText('📥 Exportar CSV');
    fireEvent.click(exportBtn);

    expect(onExportCSV).toHaveBeenCalledTimes(1);
  });
});
