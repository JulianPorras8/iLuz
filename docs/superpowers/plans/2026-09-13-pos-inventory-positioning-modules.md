# TiendaPOS Modular Expansion (Positioning & Inventory CRUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand TiendaPOS into a multi-module desktop application with Article Positioning, Location Management, Full Inventory CRUD, Manual non-barcoded product creation, CSV Inventory Export, and Context-Aware Barcode Scanning.

**Architecture:** 
- SQLite persistence layer with automatic schema migrations to extend `products` table and add `locations` table without data loss.
- Go backend exposed via Wails methods for inventory CRUD, location management, article relocation, and RFC 4180 CSV generation.
- Responsive HTML5/Vanilla JS single-page application with 4 tabbed views (`Caja`, `Posicionamiento`, `Inventario`, `Locaciones`) and context-aware hardware scanner routing.

**Tech Stack:** Go 1.25+, Wails v2, SQLite (`modernc.org/sqlite`, CGO-free, WAL mode), HTML5 / Vanilla JS.

**Spec:** [`docs/superpowers/specs/2026-09-13-pos-inventory-positioning-modules-design.md`](file:///Users/julian.porras/Documents/Personal/Projects_Organized/Projects/iLuz/docs/superpowers/specs/2026-09-13-pos-inventory-positioning-modules-design.md)

## Global Constraints
- Pure Go embedded SQLite (`modernc.org/sqlite`) in WAL mode with zero CGO dependencies.
- No Node.js / npm build step required — assets served directly via Go `embed.FS`.
- Compatible with Windows x64 target compiled from macOS via Wails v2.
- Barcode field must support manual products without barcodes by auto-generating clean internal SKUs (`INT-XXXXXX`).
- Export must produce standard comma-separated CSV with UTF-8 BOM.

---

### Task 1: Database Migration, Location Model & Extended Product CRUD

**Files:**
- Modify: `tienda-pos/db.go`
- Test: `tienda-pos/db_test.go`

**Interfaces:**
- Produces:
  - `Product` struct with `Weight`, `Size`, `UnitOfMeasure`, `Color`, `Location`, `Active`.
  - `Location` struct with `ID`, `Code`, `Name`, `Description`.
  - `updateProductLocation(db *sql.DB, barcode string, location string) error`
  - `archiveProduct(db *sql.DB, barcode string) error`
  - `restoreProduct(db *sql.DB, barcode string) error`
  - `listInventoryProducts(db *sql.DB, includeArchived bool) ([]Product, error)`
  - `saveLocation(db *sql.DB, loc Location) error`
  - `getAllLocations(db *sql.DB) ([]Location, error)`
  - `deleteLocation(db *sql.DB, id int64) error`

- [ ] **Step 1: Write failing unit tests for schema auto-migration, location CRUD, and manual product generation**
  Add tests in `tienda-pos/db_test.go` for:
  - Auto-migrating legacy databases to include new columns.
  - Auto-generating `INT-XXXXXX` code when `Product.Barcode` is empty.
  - Updating product location.
  - Archiving and restoring products.
  - Saving, listing, and deleting locations.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `go test -v ./...` in `tienda-pos`
  Expected: FAIL with compilation errors (missing struct fields and functions).

- [ ] **Step 3: Implement extended schema, migrations, and CRUD in `db.go`**
  - Update `Product` and `Location` structs.
  - In `initDB`, inspect `PRAGMA table_info(products)` and run `ALTER TABLE products ADD COLUMN ...` for any missing column.
  - Create `locations` table with `idx_locations_code`.
  - In `saveOrUpdateProduct`, generate `INT-XXXXXX` if barcode is blank.
  - Implement `updateProductLocation`, `archiveProduct`, `restoreProduct`, `listInventoryProducts`, `saveLocation`, `getAllLocations`, `deleteLocation`.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `go test -v ./...` in `tienda-pos`
  Expected: PASS

---

### Task 2: Backend App Methods & CSV Export

**Files:**
- Modify: `tienda-pos/app.go`
- Test: `tienda-pos/app_test.go`

**Interfaces:**
- Consumes: Database functions from Task 1.
- Produces:
  - `(a *App) ListInventoryProducts(includeArchived bool) ([]Product, error)`
  - `(a *App) UpdateProductLocation(barcode string, location string) error`
  - `(a *App) ArchiveProduct(barcode string) error`
  - `(a *App) RestoreProduct(barcode string) error`
  - `(a *App) GetAllLocations() ([]Location, error)`
  - `(a *App) SaveLocation(loc Location) error`
  - `(a *App) DeleteLocation(id int64) error`
  - `(a *App) ExportInventoryCSV() (string, error)`

- [ ] **Step 1: Write failing unit tests for App methods and CSV export**
  Add tests in `tienda-pos/app_test.go` for:
  - Calling `UpdateProductLocation` and verifying database update.
  - Archiving and restoring products via `App`.
  - Location CRUD via `App`.
  - Exporting inventory to CSV (verifying header line, comma separation, UTF-8 BOM, and product values).

- [ ] **Step 2: Run tests to verify they fail**
  Run: `go test -v ./...` in `tienda-pos`
  Expected: FAIL (missing methods on `App`).

- [ ] **Step 3: Implement App methods and CSV generator in `app.go`**
  - Bind inventory and location methods to `App`.
  - In `ExportInventoryCSV()`, format all inventory items using `encoding/csv` with `\xef\xbb\xbf` UTF-8 BOM.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `go test -v ./...` in `tienda-pos`
  Expected: PASS

---

### Task 3: Multi-Tab Navigation & Context-Aware Scanner Dispatcher

**Files:**
- Modify: `tienda-pos/frontend/index.html`

**Interfaces:**
- Consumes: `window.runtime.EventsOn("barcode:scanned")`.
- Produces:
  - Top navigation tabs with active view state (`currentTab`).
  - Context-aware scanner dispatcher routing scans to `handlePosScan`, `handlePositioningScan`, or `handleInventoryScan`.

- [ ] **Step 1: Add tab navigation bar and view containers in `index.html`**
  - Add tab buttons: `[ 🛒 Caja ]`, `[ 📍 Posicionamiento ]`, `[ 📦 Inventario ]`, `[ 🏷️ Locaciones ]`.
  - Wrap content into view panels: `#view-pos`, `#view-positioning`, `#view-inventory`, `#view-locations`.

- [ ] **Step 2: Implement tab switching logic in JavaScript**
  - Add `switchTab(tabName)` function to toggle visibility.
  - Maintain `currentTab` variable.

- [ ] **Step 3: Update `barcode:scanned` event listener for context routing**
  - Route incoming scans to active tab handler.

---

### Task 4: Article Positioning Module UI

**Files:**
- Modify: `tienda-pos/frontend/index.html`

**Interfaces:**
- Consumes: `UpdateProductLocation`, `GetAllLocations`, `ProcessBarcode`.
- Produces:
  - Interactive Positioning screen showing scanned product, current location badge, and relocation controls.

- [ ] **Step 1: Build Positioning View HTML**
  - Scan prompt banner.
  - Active product details card (Name, Barcode, Price, Stock, Weight, Size, Color, Unit).
  - Current location badge (Green if assigned, Amber if unassigned).
  - Relocation widget: Pre-registered location dropdown + custom location input + "Guardar Ubicación" button.

- [ ] **Step 2: Wire Positioning logic in JavaScript**
  - When a product is scanned while in `positioning` tab, populate the product card and location widget.
  - Save location calls `window.go.main.App.UpdateProductLocation(barcode, newLocation)`.
  - Update badge and show success notification.

---

### Task 5: Inventory CRUD Module, Manual Creation & CSV Export UI

**Files:**
- Modify: `tienda-pos/frontend/index.html`

**Interfaces:**
- Consumes: `ListInventoryProducts`, `SaveProduct`, `ArchiveProduct`, `RestoreProduct`, `ExportInventoryCSV`.
- Produces:
  - Full inventory table with live search and status filters.
  - Product creation/editing modal supporting all attributes.
  - One-click CSV export trigger.

- [ ] **Step 1: Build Inventory View HTML**
  - Search toolbar with search input, active/archived toggle, "[ + Nuevo Producto ]" button, and "[ 📥 Exportar CSV ]" button.
  - Inventory data table.
  - Product creation/edit modal dialog with fields for Barcode (optional for manual items), Name, Price, Stock, Unit of Measure, Weight, Size, Color, Location.

- [ ] **Step 2: Implement Inventory JavaScript logic**
  - `loadInventoryTable()`: queries `ListInventoryProducts()` and renders rows with formatting.
  - Search and filter logic.
  - Modal form submit: calls `SaveProduct()`.
  - Archive/Restore buttons: calls `ArchiveProduct()` / `RestoreProduct()`.
  - CSV export button: calls `ExportInventoryCSV()` and triggers download via `data:text/csv;charset=utf-8,` Blob link.

---

### Task 6: Location Catalog Module UI

**Files:**
- Modify: `tienda-pos/frontend/index.html`

**Interfaces:**
- Consumes: `GetAllLocations`, `SaveLocation`, `DeleteLocation`.
- Produces:
  - Store locations management table and creation modal.
  - Automatic synchronization with location dropdowns in Positioning and Inventory.

- [ ] **Step 1: Build Locations View HTML**
  - Locations table (`Código`, `Nombre`, `Descripción`, `Acciones`).
  - "[ + Nueva Locación ]" button and modal.

- [ ] **Step 2: Implement Locations JavaScript logic**
  - `loadLocations()`: queries `GetAllLocations()` and renders table.
  - Add/Edit location form submit: calls `SaveLocation()`.
  - Delete location button: calls `DeleteLocation()`.
  - Syncs location dropdowns across all views.

---

### Task 7: End-to-End Verification & Windows x64 Build

- [ ] **Step 1: Run static analysis**
  Run: `go vet ./...` in `tienda-pos`
  Expected: Clean exit (code 0).

- [ ] **Step 2: Run complete test suite**
  Run: `go test -v ./...` in `tienda-pos`
  Expected: All tests pass.

- [ ] **Step 3: Build Windows binary**
  Run: `wails build -platform windows/amd64 -clean`
  Expected: Successfully generated `build/bin/tienda-pos.exe`.
