import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import apiAdapter from '../services/apiAdapter';
import BarcodeLinkModal from '../components/BarcodeLinkModal';
import InventoryView from '../components/InventoryView';

describe('Catalog Import & Smart Barcode Linking Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.go;
  });

  describe('apiAdapter - importCatalogCSV & linkBarcodeToProduct', () => {
    it('imports CSV products, marks bulk items as quick access, and calculates prices', async () => {
      const csv = `ID,CATEGORIA,ARTICULO,CANTIDAD_STOCK,PRECIO_COSTO_COP,PRECIO_VENTA_SUGERIDO_COP,ESTANTE_ORIGINAL
1,Abarrotes y Despensa,ARROZ DIANA 500G,10,1700,2100,Estante 1
2,Panadería y Dulcería,PAN ARTESANAL UNIDAD,20,300,500,Estante 2
3,Carnes y Embutidos,CARNE DE RES LB,5,10000,12000,Estante 3
`;
      const res = await apiAdapter.importCatalogCSV(csv);
      expect(res.totalProcessed).toBe(3);
      expect(res.inserted).toBe(3);
      expect(res.updated).toBe(0);

      const products = await apiAdapter.listProducts(false);
      expect(products.length).toBe(3);

      const pan = products.find((p) => p.name === 'PAN ARTESANAL UNIDAD');
      expect(pan).toBeDefined();
      expect(pan.isQuickAccess).toBe(true);
      expect(pan.price).toBe(500);

      const carne = products.find((p) => p.name === 'CARNE DE RES LB');
      expect(carne.isQuickAccess).toBe(true);

      const arroz = products.find((p) => p.name === 'ARROZ DIANA 500G');
      expect(arroz.isQuickAccess).toBe(false);
      expect(arroz.barcode).toMatch(/^ILUZ-\d{4}$/);
    });

    it('updates existing products without overwriting their linked barcodes', async () => {
      // 1. Initial product with an EAN barcode
      await apiAdapter.saveProduct({
        id: 1,
        barcode: '7702001041412',
        name: 'ARROZ DIANA 500G',
        costPrice: 1500,
        price: 2000,
        stock: 5,
        category: 'Abarrotes',
        active: true,
      });

      // 2. Import CSV that has updated cost/price
      const csv = `ID,CATEGORIA,ARTICULO,CANTIDAD_STOCK,PRECIO_COSTO_COP,PRECIO_VENTA_SUGERIDO_COP
1,Abarrotes y Despensa,ARROZ DIANA 500G,15,1800,2300
`;
      const res = await apiAdapter.importCatalogCSV(csv);
      expect(res.totalProcessed).toBe(1);
      expect(res.updated).toBe(1);
      expect(res.inserted).toBe(0);

      const products = await apiAdapter.listProducts(false);
      const arroz = products.find((p) => p.name === 'ARROZ DIANA 500G');
      // Barcode MUST remain unchanged
      expect(arroz.barcode).toBe('7702001041412');
    });

    it('successfully links a new barcode to an existing product', async () => {
      const prod = await apiAdapter.saveProduct({
        id: 1,
        barcode: 'ILUZ-0001',
        name: 'ACEITE FRITÓN 1000 ML',
        price: 8100,
        stock: 10,
        active: true,
      });

      await apiAdapter.linkBarcodeToProduct(prod.id, '7709999123456');

      const found = await apiAdapter.searchBarcode('7709999123456');
      expect(found).toBeDefined();
      expect(found.id).toBe(prod.id);
      expect(found.barcode).toBe('7709999123456');
    });

    it('rejects linking when barcode is empty or already in use by another product', async () => {
      await apiAdapter.saveProduct({
        id: 1,
        barcode: '7701111111111',
        name: 'PRODUCTO A',
        active: true,
      });
      const prodB = await apiAdapter.saveProduct({
        id: 2,
        barcode: 'ILUZ-0002',
        name: 'PRODUCTO B',
        active: true,
      });

      // Empty barcode
      await expect(apiAdapter.linkBarcodeToProduct(prodB.id, '')).rejects.toThrow(
        /código de barras no puede estar vacío/i
      );

      // Collision
      await expect(
        apiAdapter.linkBarcodeToProduct(prodB.id, '7701111111111')
      ).rejects.toThrow(/ya está asignado al producto 'PRODUCTO A'/i);
    });
  });

  describe('BarcodeLinkModal Component', () => {
    const mockProducts = [
      { id: 1, barcode: 'ILUZ-0001', name: 'ARROZ DIANA 500G', category: 'Abarrotes', price: 2100, stock: 10, active: true },
      { id: 2, barcode: 'ILUZ-0002', name: 'ACEITE FRITÓN 1L', category: 'Abarrotes', price: 8100, stock: 5, active: true },
      { id: 3, barcode: 'ILUZ-0003', name: 'PAN ARTESANAL', category: 'Panadería', price: 500, stock: 20, active: true, isQuickAccess: true },
    ];

    it('renders scanned barcode badge and search input', () => {
      render(
        <BarcodeLinkModal
          isOpen={true}
          barcode="7702001041412"
          products={mockProducts}
          onLink={vi.fn()}
          onCreateNew={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('7702001041412')).toBeDefined();
      expect(screen.getByPlaceholderText(/Escribe nombre del producto/i)).toBeDefined();
      expect(screen.getByText('ARROZ DIANA 500G')).toBeDefined();
      expect(screen.getByText('ACEITE FRITÓN 1L')).toBeDefined();
    });

    it('filters products as user types and links on click', async () => {
      const handleLink = vi.fn();
      render(
        <BarcodeLinkModal
          isOpen={true}
          barcode="7702001041412"
          products={mockProducts}
          onLink={handleLink}
          onCreateNew={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByPlaceholderText(/Escribe nombre del producto/i);
      fireEvent.change(input, { target: { value: 'Aceite' } });

      expect(screen.getByText('ACEITE FRITÓN 1L')).toBeDefined();
      expect(screen.queryByText('PAN ARTESANAL')).toBeNull();

      // Click link button
      const linkBtn = screen.getByRole('button', { name: /🔗 Vincular Código/i });
      fireEvent.click(linkBtn);

      expect(handleLink).toHaveBeenCalledWith(2, '7702001041412', null);
    });

    it('supports keyboard Enter to link and Escape to close', () => {
      const handleLink = vi.fn();
      const handleClose = vi.fn();
      render(
        <BarcodeLinkModal
          isOpen={true}
          barcode="7702001041412"
          products={mockProducts}
          onLink={handleLink}
          onCreateNew={vi.fn()}
          onClose={handleClose}
        />
      );

      const container = screen.getByText('7702001041412').closest('.modal-container');
      fireEvent.keyDown(container, { key: 'Enter' });
      expect(handleLink).toHaveBeenCalledWith(1, '7702001041412', null);

      fireEvent.keyDown(container, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });

    it('navigates with ArrowDown and Enter, and passes optional initial stock', () => {
      const handleLink = vi.fn();
      render(
        <BarcodeLinkModal
          isOpen={true}
          barcode="7702001041412"
          products={mockProducts}
          onLink={handleLink}
          onCreateNew={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const stockInput = screen.getByPlaceholderText('Ej: 12');
      fireEvent.change(stockInput, { target: { value: '15' } });

      const container = screen.getByText('7702001041412').closest('.modal-container');
      // Arrow down selects second product (id: 2)
      fireEvent.keyDown(container, { key: 'ArrowDown' });
      fireEvent.keyDown(container, { key: 'Enter' });

      expect(handleLink).toHaveBeenCalledWith(2, '7702001041412', 15);
    });

    it('calls onCreateNew when clicking "Crear como Producto Nuevo"', () => {
      const handleCreate = vi.fn();
      const handleClose = vi.fn();
      render(
        <BarcodeLinkModal
          isOpen={true}
          barcode="7702001041412"
          products={mockProducts}
          onLink={vi.fn()}
          onCreateNew={handleCreate}
          onClose={handleClose}
        />
      );

      const createBtn = screen.getByText('➕ Crear como Producto Nuevo');
      fireEvent.click(createBtn);

      expect(handleClose).toHaveBeenCalled();
      expect(handleCreate).toHaveBeenCalledWith('7702001041412');
    });
  });

  describe('InventoryView - CSV Import Integration', () => {
    it('renders "📥 Importar Catálogo CSV" button and displays summary modal on completion', async () => {
      const handleImport = vi.fn().mockResolvedValue({
        totalProcessed: 631,
        inserted: 631,
        updated: 0,
        errors: [],
      });

      render(
        <InventoryView
          products={[]}
          onOpenNewProduct={vi.fn()}
          onEditProduct={vi.fn()}
          onToggleActive={vi.fn()}
          onExportCSV={vi.fn()}
          onImportCSV={handleImport}
        />
      );

      const importBtn = screen.getByText('📥 Importar Catálogo CSV');
      expect(importBtn).toBeDefined();

      // Simulate file selection
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeDefined();

      const fakeCSV = 'ID,ARTICULO,PRECIO_VENTA_SUGERIDO_COP\n1,TEST ITEM,1000\n';
      const file = new File([fakeCSV], 'inventario.csv', { type: 'text/csv' });
      file.text = vi.fn().mockResolvedValue(fakeCSV);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(handleImport).toHaveBeenCalledWith(fakeCSV);
        expect(screen.getByText('Catálogo Importado Exitosamente')).toBeDefined();
        expect(screen.getAllByText('631').length).toBeGreaterThan(0);
      });

      // Close modal
      const acceptBtn = screen.getByText('Aceptar');
      fireEvent.click(acceptBtn);
      expect(screen.queryByText('Catálogo Importado Exitosamente')).toBeNull();
    });
  });
});
