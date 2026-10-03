import React, { useState } from 'react';

const SuppliersView = ({ suppliers = [], onOpenNewSupplier, onEditSupplier, onDeleteSupplier }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // all, active, inactive

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = (
      (supplier.name && supplier.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.nitOrCedula && supplier.nitOrCedula.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.contactName && supplier.contactName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const matchesFilter = filterActive === 'all' 
      ? true 
      : filterActive === 'active' ? supplier.active : !supplier.active;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="suppliers-view">
      <header className="view-header">
        <div className="header-title">
          <h2>🚚 Proveedores y Distribuidores</h2>
          <span className="badge counter">{filteredSuppliers.length} proveedores</span>
        </div>
        <button className="btn btn-primary btn-new" onClick={onOpenNewSupplier}>
          + Nuevo Proveedor
        </button>
      </header>

      <div className="filters-container">
        <input 
          type="text" 
          placeholder="Buscar por nombre, NIT o contacto..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className="filter-select">
          <option value="all">Todos</option>
          <option value="active">Solo Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Razón Social / Nombre</th>
              <th>NIT / Documento</th>
              <th>Asesor / Contacto</th>
              <th>Teléfono</th>
              <th>Plazo Pago</th>
              <th>Días Entrega</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map(supplier => (
                <tr key={supplier.id}>
                  <td className="fw-bold">{supplier.name}</td>
                  <td>{supplier.nitOrCedula}</td>
                  <td>{supplier.contactName}</td>
                  <td>
                    {supplier.phone && (
                      <div className="phone-cell">
                        <a href={`tel:${supplier.phone}`} className="phone-link">{supplier.phone}</a>
                        <a href={`https://wa.me/${supplier.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="wa-link" title="WhatsApp">💬</a>
                      </div>
                    )}
                  </td>
                  <td><span className="badge badge-info">{supplier.paymentTerms}</span></td>
                  <td>{supplier.deliveryDays}</td>
                  <td>
                    <span className={`pill ${supplier.active ? 'pill-success' : 'pill-danger'}`}>
                      {supplier.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button className="btn-icon" onClick={() => onEditSupplier(supplier)} title="Editar">✏️</button>
                    <button className="btn-icon text-danger" onClick={() => onDeleteSupplier(supplier.id)} title="Desactivar / Eliminar">🗑️</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center empty-state">No se encontraron proveedores</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SuppliersView;
