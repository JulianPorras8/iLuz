import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LocationsView from '../components/LocationsView';
import LocationModal from '../components/LocationModal';
import ShelfModal from '../components/ShelfModal';

describe('Locations & Shelves - Component & Form Tests', () => {
  const mockShelves = [
    {
      id: 1,
      code: 'EST01',
      name: 'Estantería Principal',
      description: 'Pasillo de abarrotes',
      levels: [{ level: 1, name: 'Nivel 1', slots: 4 }],
    },
  ];

  const mockLocations = [
    { id: 10, code: 'EST01-N1-C1', name: 'Nivel 1 Casilla 1', description: 'Arroz y granos' },
  ];

  it('renders LocationsView with shelves list and triggers new shelf action', () => {
    const onOpenNewShelf = vi.fn();

    render(
      <LocationsView
        locations={mockLocations}
        shelves={mockShelves}
        onOpenNewShelf={onOpenNewShelf}
        onEditShelf={vi.fn()}
        onRequestDeleteShelf={vi.fn()}
        onOpenNewLocation={vi.fn()}
        onEditLocation={vi.fn()}
        onRequestDeleteLocation={vi.fn()}
      />
    );

    expect(screen.getByText(/Catálogo de Estantes, Niveles y Locaciones/i)).toBeDefined();
    expect(screen.getByText(/Estantería Principal/i)).toBeDefined();

    const newShelfBtn = screen.getByText(/Nuevo Estante Asistido/i);
    fireEvent.click(newShelfBtn);

    expect(onOpenNewShelf).toHaveBeenCalledTimes(1);
  });

  it('submits new location in LocationModal', () => {
    const onSave = vi.fn();

    render(
      <LocationModal
        isOpen={true}
        location={null}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Nueva Locación')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText(/Ej: PAS-01, EST-B2/i), { target: { value: 'BOD-01' } });
    fireEvent.change(screen.getByPlaceholderText(/Ej: Pasillo 1/i), { target: { value: 'Bodega Principal' } });

    const submitBtn = screen.getByText('Guardar Locación');
    fireEvent.click(submitBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].code).toBe('BOD-01');
    expect(onSave.mock.calls[0][0].name).toBe('Bodega Principal');
  });

  it('submits shelf with structure in ShelfModal', () => {
    const onSave = vi.fn();

    render(
      <ShelfModal
        isOpen={true}
        shelf={null}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Nueva Estantería Asistida')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText(/Ej: EST-01/i), { target: { value: 'EST02' } });
    fireEvent.change(screen.getByPlaceholderText(/Ej: Estante Frontal Tornillería/i), { target: { value: 'Estante Lácteos' } });

    const submitBtn = screen.getByText(/Guardar Estante y Generar Posiciones/i);
    fireEvent.click(submitBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].code).toBe('EST02');
    expect(onSave.mock.calls[0][0].name).toBe('Estante Lácteos');
    expect(onSave.mock.calls[0][0].levels).toHaveLength(3);
  });
});
