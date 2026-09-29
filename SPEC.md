# Software Design Document & Scaffolding Spec: iLuz (Wails v2 + Go + SQLite)

## 1. Project Overview
Aplicación de escritorio liviana para punto de venta (POS) y control de inventario local-first orientada a comercios minoristas y tiendas de abarrotes en Windows x64.
- **Backend:** Go 1.21+ con Wails v2.
- **Persistencia:** SQLite local embebido (`modernc.org/sqlite`, 100% Go, sin requerir CGO) en modo WAL con `foreign_keys=ON` y transacciones inmediatas.
- **Hardware:** Lector de código de barras omnidireccional Honeywell MS7120 conectado por emulación USB Serial (`COM3` a 9600 baudios, 8N1) y soporte universal para lectores USB Keyboard Wedge.
- **Frontend:** React 18, Vite y CSS reactivo integrado con el runtime de eventos y métodos de Wails.
- **Marco Normativo:** Adaptado para comercios en Colombia bajo la modalidad de **Persona Natural No Responsable de IVA (Art. 437 E.T.)**, emitiendo comprobantes de venta internos y gestionando mermas según el Art. 64 del Estatuto Tributario.

---

## 2. Fases de Desarrollo

### Fase 1: Inventario Físico & Auditorías por Zonas (Implementado)
* Gestión de catálogo con costo de adquisición, precios, unidades de medida y ubicaciones físicas.
* Sistema de tomas de inventario multi-día con congelamiento de stock (`inventory_sessions`), conteos multi-ubicación acumulativos y reconciliación selectiva.
* Integración fluida con el escáner Honeywell Orbit y teclado fallback.

### Fase 2: Punto de Venta (POS) & Control de Caja (En progreso / Blueprint)
* Ventas transaccionales atómicas con descuento inmediato de stock (`sales`, `sale_items`, `stock_movements`).
* Emisión de Comprobantes de Venta Internos (formato térmico 58mm / 80mm sin la palabra "Factura").
* Control de turnos y arqueos de caja (`cash_shifts`) con conciliación de ventas no registradas.
* Gestión de cuentas por cobrar (*el fiao*) y cuentas por pagar a proveedores.
* Documentación detallada en [`tienda-pos/TODO_CHECKOUT_INTEGRATION.md`](tienda-pos/TODO_CHECKOUT_INTEGRATION.md) y [`docs/LEGAL_AND_POS_FRAMEWORK_COLOMBIA.md`](docs/LEGAL_AND_POS_FRAMEWORK_COLOMBIA.md).

---

## 3. Directory Structure

```text
iLuz/
├── README.md                           # Visión general y guía de ejecución
├── SPEC.md                             # Especificación general del sistema
├── docs/
│   └── LEGAL_AND_POS_FRAMEWORK_COLOMBIA.md # Marco legal, tributario y contable
└── tienda-pos/
    ├── build/
    ├── frontend/
    │   ├── package.json
    │   └── src/
    │       ├── App.jsx
    │       └── components/
    │           ├── POSView.jsx         # Mostrador y caja de cobro
    │           ├── InventoryView.jsx   # Catálogo y existencias
    │           ├── StockAuditView.jsx  # Tomas de inventario
    │           └── ...
    ├── app.go                          # Métodos backend Wails
    ├── db.go                           # Esquema SQLite, migraciones y lógica SQL
    ├── scanner.go                      # Driver serial Honeywell Orbit
    ├── TODO_CHECKOUT_INTEGRATION.md    # Especificación de integración POS
    └── ...
```
