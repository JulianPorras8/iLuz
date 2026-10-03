import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SupplierModal from '../components/SupplierModal';

describe('SupplierModal Component Integration Tests', () => {
  it('renders correctly in Create mode with empty fields', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <SupplierModal
        isOpen={true}
        supplier={null}
        onSave={handleSave}
        onClose={handleClose}
      />
    );

    expect(screen.getByText('Nuevo Proveedor o Distribuidor')).toBeDefined();
    expect(screen.getByPlaceholderText('Ej: Distribuidora La 14, Postobón S.A.')).toBeDefined();
    expect(screen.getByPlaceholderText('Ej: 900.123.456-7')).toBeDefined();
  });

  it('submits form with entered data and triggers onSave', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <SupplierModal
        isOpen={true}
        supplier={null}
        onSave={handleSave}
        onClose={handleClose}
      />
    );

    const nameInput = screen.getByPlaceholderText('Ej: Distribuidora La 14, Postobón S.A.');
    const nitInput = screen.getByPlaceholderText('Ej: 900.123.456-7');
    const phoneInput = screen.getByPlaceholderText('Ej: 3101234567');

    fireEvent.change(nameInput, { target: { value: 'Bavaria Colombia' } });
    fireEvent.change(nitInput, { target: { value: '860.005.224-6' } });
    fireEvent.change(phoneInput, { target: { value: '3109876543' } });

    const submitBtn = screen.getByText('💾 Guardar Proveedor');
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    const submittedData = handleSave.mock.calls[0][0];
    expect(submittedData.name).toBe('Bavaria Colombia');
    expect(submittedData.nitOrCedula).toBe('860.005.224-6');
    expect(submittedData.phone).toBe('3109876543');
    expect(submittedData.active).toBe(true);
  });

  it('renders with prefilled data in Edit mode', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    const existingSupplier = {
      id: 42,
      name: 'Postobón Central',
      nitOrCedula: '890.903.939-5',
      contactName: 'Laura Restrepo',
      phone: '3201112233',
      paymentTerms: 'Crédito 30 días',
      active: true,
    };

    render(
      <SupplierModal
        isOpen={true}
        supplier={existingSupplier}
        onSave={handleSave}
        onClose={handleClose}
      />
    );

    expect(screen.getByText('Editar Proveedor')).toBeDefined();
    expect(screen.getByDisplayValue('Postobón Central')).toBeDefined();
    expect(screen.getByDisplayValue('Laura Restrepo')).toBeDefined();
    expect(screen.getByDisplayValue('3201112233')).toBeDefined();
  });

  it('calls onClose when clicking Cancel or close button', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <SupplierModal
        isOpen={true}
        supplier={null}
        onSave={handleSave}
        onClose={handleClose}
      />
    );

    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeIcon = screen.getByTitle('Cerrar (Esc)');
    fireEvent.click(closeIcon);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
