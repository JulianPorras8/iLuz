# Design Document: TiendaPOS Modular Expansion (Positioning & Inventory CRUD)

**Date**: 2026-09-13  
**Status**: Approved  
**Author**: Antigravity  

---

## 1. Executive Summary

This document specifies the design for expanding **TiendaPOS** from a standalone POS checkout screen into a modular desktop application featuring:
1. **Article Positioning Module** (*Módulo de Posicionamiento*): Fast lookup of physical item locations via barcode scanner, display of current position, and instant re-assignment/assignment of store or warehouse locations.
2. **Location Catalog Module** (*Módulo de Locaciones*): Dedicated view to pre-define and manage store aisles, racks, shelves, and zones.
3. **Full Inventory CRUD Module** (*Módulo de Inventario*): Comprehensive catalog management with search, filters, creation/editing modal, and soft-delete/archiving.
4. **Manual Products Without Barcode**: Support for registering non-barcoded items (e.g., bulk goods, fruits, bakery, services). If a barcode is omitted, the system auto-assigns an internal SKU (`INT-XXXXX`), allowing these products to be searched and sold by name or code.
5. **CSV Inventory Export**: One-click export of the active inventory catalog to a standard comma-separated CSV file (UTF-8 formatted for Microsoft Excel / Sheets).
6. **Expanded Product Schema**: Incorporating Weight, Size, Unit of Measure, Color, Physical Location, and Active status.
7. **Context-Aware Barcode Scanner**: Hardware scanner events are dynamically dispatched depending on the active view (POS cart, positioning card, or inventory filter).

---

## 2. Architecture & Data Model

### 2.1 SQLite Schema & Automatic Migration (`db.go`)

To guarantee seamless backward compatibility with existing databases, `initDB()` runs automatic migration checks using SQLite `PRAGMA table_info(products)` to add any missing columns.

#### `products` Table (Extended)
```sql
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode         TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    price           REAL NOT NULL DEFAULT 0.0,
    stock           INTEGER NOT NULL DEFAULT 0,
    weight          REAL NOT NULL DEFAULT 0.0,
    size            TEXT NOT NULL DEFAULT '',
    unit_of_measure TEXT NOT NULL DEFAULT 'und',
    color           TEXT NOT NULL DEFAULT '',
    location        TEXT NOT NULL DEFAULT '',
    active          INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_location ON products(location);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
```

#### `locations` Table (New)
```sql
CREATE TABLE IF NOT EXISTS locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);
```

### 2.2 Go Domain Models
```go
type Product struct {
    ID            int64   `json:"id"`
    Barcode       string  `json:"barcode"`
    Name          string  `json:"name"`
    Price         float64 `json:"price"`
    Stock         int     `json:"stock"`
    Weight        float64 `json:"weight"`
    Size          string  `json:"size"`
    UnitOfMeasure string  `json:"unitOfMeasure"`
    Color         string  `json:"color"`
    Location      string  `json:"location"`
    Active        bool    `json:"active"`
}

type Location struct {
    ID          int64  `json:"id"`
    Code        string `json:"code"`
    Name        string `json:"name"`
    Description string `json:"description"`
}
```

---

## 3. Backend Interfaces & Methods (`app.go`, `db.go`)

The `App` struct binds the following methods to the Wails runtime:

### 3.1 Product & Inventory Operations
- `SaveProduct(p Product) error`: Upserts a product with all attributes. If `p.Barcode` is empty/trimmed, automatically generates a unique internal identifier (e.g. `INT-XXXXXX`).
- `ListInventoryProducts(includeArchived bool) ([]Product, error)`: Fetches items for the inventory table.
- `GetAllProducts() ([]Product, error)`: Fetches active items for POS checkout.
- `SearchBarcode(barcode string) (*Product, error)`: Fetches a single item by barcode or internal code.
- `ArchiveProduct(barcode string) error`: Soft deletes a product (`active = 0`).
- `RestoreProduct(barcode string) error`: Restores an archived product (`active = 1`).
- `ExportInventoryCSV() (string, error)`: Generates comma-separated CSV text with UTF-8 BOM, headers, and all product columns.

### 3.2 Positioning Operations
- `UpdateProductLocation(barcode string, location string) error`: Updates the `location` field for the specified product and emits `barcode:scanned`.

### 3.3 Location Catalog Operations
- `GetAllLocations() ([]Location, error)`: Retrieves all registered store locations.
- `SaveLocation(loc Location) error`: Upserts a location entry.
- `DeleteLocation(id int64) error`: Deletes a location entry from the catalog.

### 3.4 Hardware Scanner Control
- `ProcessBarcode(barcode string) ScanPayload`: Core dispatcher for keyboard and manual scans.
- `GetScannerStatus() ScannerStatusPayload`: Retrieves connection state.
- `SetScannerPort(portName string)`: Switches serial COM port on the fly.
- `GetAvailablePorts() []string`: Discovers all COM ports on Windows.
- `GetCurrentPort() string`: Returns active COM port.

---

## 4. Frontend Architecture & UI (`frontend/index.html`)

### 4.1 Navigation
Top navigation bar containing:
- Logo / App Title: `Tienda POS`
- Module Tabs:
  - `[ 🛒 Caja / POS ]`
  - `[ 📍 Posicionamiento ]`
  - `[ 📦 Inventario ]`
  - `[ 🏷️ Locaciones ]`
- Global manual search/scan input bar
- COM Port selector and hardware connection badge

### 4.2 Module 1: [ 🛒 Caja / POS ]
- Active sales cart table with barcode, description, price, quantity, and subtotal.
- Total to charge with clear sale button.
- Quick product search dropdown/filter by name or code for products without a physical barcode.
- Last scanned product card and unregistered item quick-entry form.

### 4.3 Module 2: [ 📍 Posicionamiento ]
- Scanning any barcode displays:
  - Product summary card (Name, Barcode, Stock, Price, Weight, Size, Color, Unit).
  - Prominent Location Badge: Green (`📍 Pasillo 2 - Estante B`) or Amber (`⚠️ Sin ubicación asignada`).
  - Relocation controls: Select from registered locations dropdown or type custom location code.
  - Quick action button: **[ Guardar Ubicación ]** (Enter key triggers save).

### 4.4 Module 3: [ 📦 Inventario ]
- Live search bar (name, barcode, location, color).
- Status toggle: *Todos / Activos / Archivados*.
- Action toolbar:
  - **[ + Nuevo Producto ]**: Opens modal. If barcode is left blank, marks as manual product with auto-generated code.
  - **[ 📥 Exportar CSV ]**: Exports entire inventory to comma-separated CSV file (`inventario_YYYY-MM-DD.csv`).
- Data table with all attributes: `Código`, `Nombre`, `Precio`, `Stock`, `Unidad`, `Peso`, `Tamaño`, `Color`, `Ubicación`, `Estado`, `Acciones`.
- Action buttons: *Editar* (modal) and *Archivar / Reactivar*.

### 4.5 Module 4: [ 🏷️ Locaciones ]
- Table listing all defined store locations (`code`, `name`, `description`).
- Modal/form to add or edit locations.
- Locations registered here immediately populate the dropdowns in Positioning and Inventory.

### 4.6 Context-Aware Barcode Event Dispatcher
The frontend tracks `currentTab`:
- `pos`: Adds product to sales cart.
- `positioning`: Loads product into positioning card and focuses location input.
- `inventory`: Filters inventory table by scanned barcode and highlights the item.

---

## 5. Testing & Verification

1. **`db_test.go`**:
   - Verify SQLite auto-migration on existing databases.
   - Verify product upsert with new fields (`weight`, `size`, `unit_of_measure`, `color`, `location`, `active`).
   - Verify auto-generation of internal codes when barcode is empty.
   - Verify `updateProductLocation`.
   - Verify soft deletion (`archiveProduct` / `restoreProduct`).
   - Verify location catalog CRUD.
2. **`scanner_test.go`**:
   - Verify `processScannedBarcode` with full product payload.
3. **`app_test.go`**:
   - Verify all Wails-bound methods for inventory, locations, and CSV export.
4. **Verification Commands**:
   - `go vet ./...`
   - `go test -v ./...`
   - `wails build -platform windows/amd64 -clean`
