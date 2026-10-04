import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '../components/SettingsModal';

describe('SettingsModal - Component & Configuration Tests', () => {
  const mockConfig = {
    storeName: 'Abarrotes Don Lucho',
    ownerName: 'Luis Porras',
    nitOrCedula: '12345678-9',
    address: 'Calle 10 # 5-20',
    phone: '3101234567',
    receiptFooter: '¡Gracias por apoyar el comercio local!',
    allowNegativeStock: true,
  };

  beforeEach(() => {
    delete window.go;
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders store details and allows editing', () => {
    const onSaveConfig = vi.fn();

    const { container } = render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        currentConfig={mockConfig}
        onSaveConfig={onSaveConfig}
      />
    );

    expect(screen.getByText(/Configuración del Sistema/i)).toBeDefined();

    // Store Name input by name attribute
    const storeNameInput = container.querySelector('input[name="storeName"]');
    expect(storeNameInput.value).toBe('Abarrotes Don Lucho');

    fireEvent.change(storeNameInput, { target: { value: 'Supertienda La Esmeralda' } });

    // Save
    const saveBtn = screen.getByText(/Guardar Configuración/i);
    fireEvent.click(saveBtn);

    expect(onSaveConfig).toHaveBeenCalledTimes(1);
    const saved = onSaveConfig.mock.calls[0][0];
    expect(saved.storeName).toBe('Supertienda La Esmeralda');
  });

  it('toggles tabs and allows configuring negative stock rule', () => {
    const onSaveConfig = vi.fn();

    const { container } = render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        currentConfig={mockConfig}
        onSaveConfig={onSaveConfig}
      />
    );

    // Switch to Rules tab
    const rulesTabBtn = screen.getByText(/Reglas de Venta/i);
    fireEvent.click(rulesTabBtn);

    // Find negative stock toggle by name attribute
    const negativeStockCheckbox = container.querySelector('input[name="allowNegativeStock"]');
    expect(negativeStockCheckbox.checked).toBe(true);

    fireEvent.click(negativeStockCheckbox);
    expect(negativeStockCheckbox.checked).toBe(false);

    // Save
    const saveBtn = screen.getByText(/Guardar Configuración/i);
    fireEvent.click(saveBtn);

    expect(onSaveConfig).toHaveBeenCalledTimes(1);
    expect(onSaveConfig.mock.calls[0][0].allowNegativeStock).toBe(false);
  });
});
