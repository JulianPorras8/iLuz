# iLuz Fase 3: Punto de Venta, Compras, Proveedores y Ergonomía Táctil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 12 requirements from Phase 3 specification, resolving the CSV audit crash, restricting inventory audits to whole shelves, enabling catalog-driven quick access items in checkout, adding full Suppliers & Purchase Intake modules with invoice attachments, periodic reporting (weekly/monthly/annual), and modernizing touchscreen UX and global hotkeys.

**Architecture:** 
Extend the SQLite data layer with `suppliers`, `purchases`, `purchase_items` and `products.is_quick_access`, using atomic transactions for inventory intake and stock cost adjustments. Expose thread-safe Go methods via Wails v2 with defensive file dialogs and CSV streaming, and build modular React 18 components with touch-first accessibility (48px targets, scaled fonts, 4-module scrollable navigation, and dedicated hardware/settings hubs).

**Tech Stack:** Go 1.22, Wails v2.15, modernc.org/sqlite, React 18, Vite 5, Tailwind-like CSS, Windows AMD64 target.

**Spec:** [`docs/ROADMAP_FASE_3_POS_INVENTARIO.md`](file:///Users/julian.porras/Documents/Personal/Projects_Organized/Projects/iLuz/docs/ROADMAP_FASE_3_POS_INVENTARIO.md)

## Global Constraints

- **Fiscal Compliance:** Colombian Persona Natural No Responsable de IVA (< 3.500 UVT/year); receipts must maintain "Comprobante de Venta Interno" title.
- **Stock Rules:** Negative stock permitted with subtle warnings; transactions must remain atomic (`BEGIN IMMEDIATE`).
- **Database Migrations:** Schema changes must use idempotent SQL statements (`ALTER TABLE ... ADD COLUMN` inside try/catch or SQLite column existence check).
- **Driver Datetime Quirk:** Always use `datetime(col) > datetime(?)` when comparing timestamps in SQLite with modernc driver.
- **Wails File Dialog Safety:** Never invoke blocking UI dialogs on Windows without `defer/recover` and fallback to browser Blob downloads.
- **Primary Language:** English documentation and code; user-facing POS strings in Spanish.

---

## File Structure

```
tienda-pos/
├── db.go                                          # Persist: suppliers, purchases, purchase_items, reports, quick_access
├── db_test.go                                     # Unit tests: suppliers CRUD, purchase intake tx, financial reports
├── app.go                                         # Wails bindings & safe CSV export
├── app_test.go                                    # Unit tests: Wails API wrapper methods
└── frontend/src/
    ├── index.css                                  # Scaled typography (15px-16px, 28px metrics), touch targets (48px)
    ├── App.jsx                                    # State, global hotkeys (F1-F12), router, scan auto-edit
    └── components/
        ├── Header.jsx                             # Scrollable 4-module suite header
        ├── HardwareModal.jsx                      # Dedicated scanner & device management modal [NEW]
        ├── SettingsModal.jsx                      # Tabbed settings (Tienda, Ventas, Hardware, Backups)
        ├── ProductModal.jsx                       # is_quick_access checkbox & combobox
        ├── POSView.jsx                            # Dynamic quick access items + [Ver todos]
        ├── QuickProductsModal.jsx                 # Full-screen touch grid of quick products [NEW]
        ├── StartAuditModal.jsx                    # Shelf-only scope picker
        ├── AuditReconciliationModal.jsx           # Safe CSV export button with persistent ID
        ├── SuppliersView.jsx                      # Suppliers list, search, status [NEW]
        ├── SupplierModal.jsx                      # Supplier creation/edit form [NEW]
        ├── PurchaseIntakeView.jsx                 # Live order intake session with barcode scanning [NEW]
        └── ReportsView.jsx                        # Sales & Purchases reports (weekly/monthly/annual) [NEW]
```

---

## Task Decomposition

### Task 1: Database Layer - Migrations, Suppliers, Purchases & Reporting Queries

**Files:**
- Modify: `tienda-pos/db.go:120-250`, `tienda-pos/db.go:1600-1804`
- Test: `tienda-pos/db_test.go`

**Interfaces:**
- Consumes: Existing SQLite connection `*sql.DB`, `products` table.
- Produces:
  - `migratePhase3Tables(db *sql.DB) error`
  - `listSuppliersDB(db *sql.DB, activeOnly bool) ([]Supplier, error)`
  - `saveSupplierDB(db *sql.DB, s Supplier) (*Supplier, error)`
  - `deleteSupplierDB(db *sql.DB, id int64) error`
  - `createPurchaseTx(db *sql.DB, p PurchaseInput) (*Purchase, error)`
  - `completePurchaseTx(db *sql.DB, purchaseID int64) error`
  - `listPurchasesDB(db *sql.DB, limit int) ([]Purchase, error)`
  - `getSalesReportSummaryDB(db *sql.DB, period string) (*ReportSummary, error)`
  - `getPurchasesReportSummaryDB(db *sql.DB, period string) (*ReportSummary, error)`

- [ ] **Step 1: Write failing tests in `db_test.go` for Phase 3 tables and operations**

```go
func TestPhase3SuppliersAndPurchases(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// 1. Supplier CRUD
	s, err := saveSupplierDB(db, Supplier{
		Name:         "Distribuidora Los Alpes",
		NitOrCedula:  "900123456-1",
		Phone:        "3101234567",
		PaymentTerms: "Crédito 15 días",
		Active:       true,
	})
	if err != nil {
		t.Fatalf("error saving supplier: %v", err)
	}
	if s.ID <= 0 {
		t.Errorf("expected positive supplier ID, got %d", s.ID)
	}

	suppliers, err := listSuppliersDB(db, true)
	if err != nil || len(suppliers) != 1 {
		t.Fatalf("expected 1 active supplier, got %d (err: %v)", len(suppliers), err)
	}

	// 2. Product quick access flag
	prod, err := saveProductDB(db, Product{
		Barcode:       "7701234567890",
		Name:          "Leche Entera 1L",
		Price:         4200,
		CostPrice:     3500,
		Stock:         10,
		Active:        true,
		IsQuickAccess: true,
	})
	if err != nil {
		t.Fatalf("error saving product with quick access: %v", err)
	}
	if !prod.IsQuickAccess {
		t.Errorf("expected IsQuickAccess to be true")
	}

	// 3. Purchase Intake with stock and cost update
	pInput := PurchaseInput{
		SupplierID:    s.ID,
		InvoiceNumber: "FAC-9876",
		InvoiceDate:   "2026-10-02",
		PaymentStatus: "paid",
		TotalCost:     70000,
		Items: []PurchaseItemInput{
			{
				ProductID:      prod.ID,
				Barcode:        prod.Barcode,
				ProductName:    prod.Name,
				Qty:            20,
				UnitCost:       3500,
				SuggestedPrice: 4500,
			},
		},
	}
	purchase, err := createPurchaseTx(db, pInput)
	if err != nil {
		t.Fatalf("error creating purchase tx: %v", err)
	}
	if purchase.ID <= 0 {
		t.Errorf("expected valid purchase ID")
	}

	// Verify stock updated from 10 to 30 and cost updated
	updatedProd, err := getProductByBarcodeDB(db, prod.Barcode)
	if err != nil {
		t.Fatalf("error fetching updated prod: %v", err)
	}
	if updatedProd.Stock != 30 {
		t.Errorf("expected stock 30 after purchase intake, got %d", updatedProd.Stock)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test -v -run TestPhase3SuppliersAndPurchases ./tienda-pos`  
Expected: FAIL (types / methods undefined)

- [ ] **Step 3: Implement Structs, Migrations, and DB functions in `tienda-pos/db.go`**

Define structs: `Supplier`, `Purchase`, `PurchaseItem`, `PurchaseInput`, `PurchaseItemInput`, `ReportSummary`.  
Add column `is_quick_access BOOLEAN DEFAULT 0` in `migratePOSTables`.  
Create `suppliers`, `purchases`, `purchase_items` tables.  
Implement `listSuppliersDB`, `saveSupplierDB`, `deleteSupplierDB`, `createPurchaseTx`, `listPurchasesDB`, `getSalesReportSummaryDB`, `getPurchasesReportSummaryDB`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test -v -run TestPhase3SuppliersAndPurchases ./tienda-pos`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tienda-pos/db.go tienda-pos/db_test.go
git commit -m "feat(backend): add schema and db functions for suppliers, purchases, quick access and reports"
```

---

### Task 2: Backend App Bindings & Audit CSV Export Crash Fix (REQ-02, REQ-03)

**Files:**
- Modify: `tienda-pos/app.go:440-520`
- Modify: `tienda-pos/db.go:1214-1260`
- Test: `tienda-pos/app_test.go`

**Interfaces:**
- Consumes: Task 1 database methods.
- Produces:
  - `(a *App) ListSuppliers(activeOnly bool) ([]Supplier, error)`
  - `(a *App) SaveSupplier(s Supplier) (*Supplier, error)`
  - `(a *App) DeleteSupplier(id int64) error`
  - `(a *App) CreatePurchase(input PurchaseInput) (*Purchase, error)`
  - `(a *App) ListPurchases(limit int) ([]Purchase, error)`
  - `(a *App) GetFinancialReports(period string) (*FinancialReportData, error)`
  - Defensive `(a *App) ExportInventorySessionCSVFile(sessionId int64) (string, error)`

- [ ] **Step 1: Write test for safe CSV export and closed session report in `app_test.go`**

```go
func TestSafeExportSessionCSV(t *testing.T) {
	app, db := setupTestApp(t)
	defer db.Close()

	// Create and close session
	sess, err := app.StartInventorySession("Auditoría Test", "Tester", "EST01", "")
	if err != nil {
		t.Fatalf("error starting session: %v", err)
	}

	closed, err := app.CloseInventorySession(sess.ID, []int64{})
	if err != nil {
		t.Fatalf("error closing session: %v", err)
	}

	// Verify CSV data can be generated on closed session without error
	csvStr, err := app.ExportInventorySessionCSV(closed.ID)
	if err != nil {
		t.Fatalf("expected successful CSV export, got: %v", err)
	}
	if !strings.Contains(csvStr, "REPORTE DE TOMA DE INVENTARIO") {
		t.Errorf("CSV header missing")
	}
}
```

- [ ] **Step 2: Run test to verify behavior**

Run: `go test -v -run TestSafeExportSessionCSV ./tienda-pos`

- [ ] **Step 3: Fix `ExportInventorySessionCSVFile` with defer/recover and default documents directory in `app.go`**

Wrap file dialog call in defer/recover. If context or WebView2 fails or is unsupported, save to user documents `~/Documents/iLuz_Reportes/` automatically and return path, avoiding process crash.

- [ ] **Step 4: Expose Phase 3 App Methods in `app.go`**

Expose `ListSuppliers`, `SaveSupplier`, `DeleteSupplier`, `CreatePurchase`, `ListPurchases`, `GetFinancialReports`.

- [ ] **Step 5: Run all backend tests**

Run: `go test ./tienda-pos/...`  
Expected: 100% PASS

- [ ] **Step 6: Commit**

```bash
git add tienda-pos/app.go tienda-pos/app_test.go tienda-pos/db.go
git commit -m "fix(audit): prevent CSV crash on Windows and expose Phase 3 Wails methods"
```

---

### Task 3: Frontend Immediate Wins - Scan Auto-Edit & Shelf-Only Audits (REQ-01, REQ-03, REQ-02 UI)

**Files:**
- Modify: `tienda-pos/frontend/src/App.jsx:210-230`
- Modify: `tienda-pos/frontend/src/components/StartAuditModal.jsx:110-150`
- Modify: `tienda-pos/frontend/src/components/AuditReconciliationModal.jsx:335-360`

**Interfaces:**
- Consumes: `StartAuditModal` props (`shelves`), `App.jsx` scan router.
- Produces:
  - Inventory tab scan: opens `ProductModal` with `product` preloaded if found.
  - `StartAuditModal`: renders whole shelf checkboxes (`shelves.map(...)`) or `ALL`.
  - `AuditReconciliationModal`: passes active/closed `sessionId` explicitly to download without relying on mutable state.

- [ ] **Step 1: Update `handleIncomingScan` in `App.jsx` for inventory tab**

```javascript
} else if (currentTab === 'inventory') {
  if (found && product) {
    showToast(`✏️ Editando: ${product.name}`, 'info');
    setEditingProduct(product);
    setIsProductModalOpen(true);
  } else {
    showToast(`Código no registrado: ${barcode}`, 'warning');
    setEditingProduct({ barcode, active: true });
    setIsProductModalOpen(true);
  }
}
```

- [ ] **Step 2: Restructure `StartAuditModal.jsx` to select only whole Shelves**

Replace flat locations dropdown with:
- Radio 1: "🏢 Toda la Tienda (Todos los productos)" (`scope = 'ALL'`)
- Radio 2: "🗄️ Por Estantería(s)" (`scope = 'SHELVES'`)
- Checkbox list of `shelves` (`EST01 - Estante Central`, `NEV01 - Nevera`, etc.).
On start, sends comma-separated shelf codes (e.g. `EST01,EST02`).

- [ ] **Step 3: Harden CSV download in `App.jsx` and `AuditReconciliationModal.jsx`**

Pass `sessionId={session.id}` directly to `onExportCSV(session.id)`. In `handleExportSessionCSV(id)`, check fallback and trigger native download blob immediately if Go dialog returns null/error.

- [ ] **Step 4: Verify with `npm run build`**

Run: `npm run build` in `tienda-pos/frontend`  
Expected: Build succeeds cleanly.

- [ ] **Step 5: Commit**

```bash
git add tienda-pos/frontend/src/App.jsx tienda-pos/frontend/src/components/StartAuditModal.jsx tienda-pos/frontend/src/components/AuditReconciliationModal.jsx
git commit -m "feat(inventory): auto-open modal on existing scan and restrict audits to whole shelves"
```

---

### Task 4: Dynamic Quick Access Products in Checkout (REQ-04)

**Files:**
- Modify: `tienda-pos/frontend/src/components/ProductModal.jsx`
- Modify: `tienda-pos/frontend/src/components/POSView.jsx`
- Create: `tienda-pos/frontend/src/components/QuickProductsModal.jsx`
- Modify: `tienda-pos/frontend/src/App.jsx`

**Interfaces:**
- Consumes: `products` with `isQuickAccess: boolean`.
- Produces:
  - `ProductModal`: Checkbox for `isQuickAccess`.
  - `QuickProductsModal`: Modal grid with all quick products, search filter, and 1-tap cart addition.
  - `POSView`: Renders top 6 quick chips dynamically + `[➕ Ver todos (N)]` button.

- [ ] **Step 1: Add `isQuickAccess` checkbox to `ProductModal.jsx`**

Add `isQuickAccess: product?.isQuickAccess || false` in `formData`.  
Render clean checkbox in form attributes.

- [ ] **Step 2: Create `QuickProductsModal.jsx`**

Grid of touch-friendly cards showing product name, price, stock, and shortcut to add 1 unit or custom qty directly to cart.

- [ ] **Step 3: Update `POSView.jsx`**

Replace static `QUICK_PRODUCTS` array with `products.filter(p => p.isQuickAccess && p.active)`.  
Display visible pills (up to 6) and render `[➕ Ver todos (X)]` opening `QuickProductsModal`.

- [ ] **Step 4: Verify with `npm run build`**

Run: `npm run build` in `tienda-pos/frontend`  
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add tienda-pos/frontend/src/components/ProductModal.jsx tienda-pos/frontend/src/components/POSView.jsx tienda-pos/frontend/src/components/QuickProductsModal.jsx tienda-pos/frontend/src/App.jsx
git commit -m "feat(pos): dynamic quick-access products and touch grid modal"
```

---

### Task 5: Suppliers Management CRUD Module (REQ-05)

**Files:**
- Create: `tienda-pos/frontend/src/components/SupplierModal.jsx`
- Create: `tienda-pos/frontend/src/components/SuppliersView.jsx`
- Modify: `tienda-pos/frontend/src/App.jsx`
- Modify: `tienda-pos/frontend/src/components/Header.jsx`

**Interfaces:**
- Consumes: Wails `ListSuppliers`, `SaveSupplier`, `DeleteSupplier`.
- Produces:
  - `currentTab === 'suppliers'` rendered in `App.jsx`.
  - Search, filter by active status, add/edit supplier modal, quick WhatsApp/Phone link.

- [ ] **Step 1: Create `SupplierModal.jsx`**

Form fields: `name` (required), `nitOrCedula`, `contactName`, `phone`, `email`, `address`, `paymentTerms` (Contado, Crédito 8d, 15d, 30d), `notes`, `active`.

- [ ] **Step 2: Create `SuppliersView.jsx`**

Table with search input, active/inactive badge, phone click-to-call, edit button, and delete/archive confirmation.

- [ ] **Step 3: Wire into `App.jsx` and load initial data**

Add `suppliers` state, load in `loadInitialData`, and render `SuppliersView` when tab is active.

- [ ] **Step 4: Verify with `npm run build`**

Run: `npm run build` in `tienda-pos/frontend`

- [ ] **Step 5: Commit**

```bash
git add tienda-pos/frontend/src/components/SupplierModal.jsx tienda-pos/frontend/src/components/SuppliersView.jsx tienda-pos/frontend/src/App.jsx tienda-pos/frontend/src/components/Header.jsx
git commit -m "feat(suppliers): add CRUD view and modal for supplier management"
```

---

### Task 6: Purchase Intake by Order / Invoice with Attachments (REQ-06)

**Files:**
- Create: `tienda-pos/frontend/src/components/PurchaseIntakeView.jsx`
- Modify: `tienda-pos/frontend/src/App.jsx`

**Interfaces:**
- Consumes: `suppliers`, `products`, `CreatePurchase`, barcode scan stream.
- Produces:
  - Active intake session where scans append to purchase items.
  - Invoice metadata (supplier, invoice number, invoice date, payment status).
  - File attachment (photo/PDF) local upload.
  - Finalize button triggering stock and cost price atomic update.

- [ ] **Step 1: Create `PurchaseIntakeView.jsx`**

Split layout:
- Left: Invoice header details (Supplier picker, Invoice #, Date, Payment status, File attachment button showing preview/filename).
- Right: Scanned items table with Barcode, Name, Qty (+/- buttons), Unit Cost (editable), Subtotal, and suggested retail price.
- Bottom: Total invoice cost sum, "Cancelar Entrada", and "✅ Finalizar e Ingresar a Inventario".

- [ ] **Step 2: Connect barcode scan listener in `App.jsx` for `purchases` tab**

When in `currentTab === 'purchases'` and intake session is active:
- Scanning an item increments qty or adds new row.
- If item is unregistered, opens quick product registration and inserts into purchase.

- [ ] **Step 3: Implement submit action calling `CreatePurchase`**

Sends payload to backend, increments catalog stock, updates cost price, triggers success chime, and shows toast.

- [ ] **Step 4: Verify with `npm run build`**

Run: `npm run build` in `tienda-pos/frontend`

- [ ] **Step 5: Commit**

```bash
git add tienda-pos/frontend/src/components/PurchaseIntakeView.jsx tienda-pos/frontend/src/App.jsx
git commit -m "feat(purchases): implement live order intake session with barcode scanning and attachments"
```

---

### Task 7: Financial Reporting Dashboard (REQ-07)

**Files:**
- Create: `tienda-pos/frontend/src/components/ReportsView.jsx`
- Modify: `tienda-pos/frontend/src/App.jsx`

**Interfaces:**
- Consumes: Wails `GetFinancialReports(period)`.
- Produces:
  - Sales & Purchases comparison cards (Weekly, Monthly, Yearly).
  - Gross profit margin ($ and %).
  - Colombian DIAN non-responsible threshold meter (< 3,500 UVT).
  - Top 10 selling products and payment method breakdown (Cash vs Transfer vs Fiao).

- [ ] **Step 1: Create `ReportsView.jsx`**

Controls: Period toggle (`Semana`, `Mes`, `Año`).  
Metric cards: Total Sales, Total Purchases, Gross Margin, Average Ticket.  
DIAN UVT tracker bar.  
Table of top products and payment method pie/cards.  
Export to CSV button.

- [ ] **Step 2: Wire `ReportsView` into `App.jsx`**

Add `currentTab === 'reports'` view render.

- [ ] **Step 3: Verify with `npm run build`**

Run: `npm run build` in `tienda-pos/frontend`

- [ ] **Step 4: Commit**

```bash
git add tienda-pos/frontend/src/components/ReportsView.jsx tienda-pos/frontend/src/App.jsx
git commit -m "feat(reports): add periodic sales, purchases and gross profit dashboard"
```

---

### Task 8: Ergonomics, Scaled Typography, Hotkeys, Hardware & Settings Hub (REQ-08 - REQ-12)

**Files:**
- Modify: `tienda-pos/frontend/src/index.css`
- Modify: `tienda-pos/frontend/src/components/Header.jsx`
- Create: `tienda-pos/frontend/src/components/HardwareModal.jsx`
- Modify: `tienda-pos/frontend/src/components/SettingsModal.jsx`
- Modify: `tienda-pos/frontend/src/App.jsx`

**Interfaces:**
- Consumes: System events, scanner status.
- Produces:
  - Scaled typography: 15px-16px body, 24px-28px price metrics.
  - Min 48px touch targets for buttons.
  - Scrollable 4-module priority navigation in `Header.jsx`.
  - Global hotkeys listener (<kbd>F1</kbd>-<kbd>F6</kbd>, <kbd>F12</kbd>, <kbd>Esc</kbd>).
  - `HardwareModal` separating COM port status from main navigation.
  - 4-tab `SettingsModal` (Tienda, Ventas, Hardware, Copias de Seguridad).

- [ ] **Step 1: Update `index.css` with scaled typography & touch target minimums**

Increase base font to 15px, table cell padding to 12px, button height to 46-50px with `touch-action: manipulation`.

- [ ] **Step 2: Update `Header.jsx` with scrollable 4-module visible container**

Show primary 4: `Caja`, `Inventario`, `Locaciones`, `Entradas`. Provide horizontal scroll/arrows for `Proveedores`, `Reportes`. Move scanner icon into dedicated Hardware modal button.

- [ ] **Step 3: Create `HardwareModal.jsx`**

Displays scanner connection status (online/offline), COM port selector, test scan input, and baud rate.

- [ ] **Step 4: Redesign `SettingsModal.jsx` into structured tabs**

Tabs: `🏪 Datos Tienda`, `⚙️ Reglas de Venta`, `🔌 Dispositivos`, `💾 Respaldo y Base de Datos`.

- [ ] **Step 5: Register global hotkeys in `App.jsx`**

Listen for `F1` (POS), `F2` (Inventario), `F3` (Locaciones), `F4` (Entradas), `F5` (Proveedores), `F6` (Reportes).

- [ ] **Step 6: Verify with `npm run build`**

Run: `npm run build` in `tienda-pos/frontend`

- [ ] **Step 7: Commit**

```bash
git add tienda-pos/frontend/src/index.css tienda-pos/frontend/src/components/Header.jsx tienda-pos/frontend/src/components/HardwareModal.jsx tienda-pos/frontend/src/components/SettingsModal.jsx tienda-pos/frontend/src/App.jsx
git commit -m "feat(ui): scaled typography, touch targets, hotkeys, scrollable header and hardware modal"
```

---

### Task 9: End-to-End Build, Full Test Suite & Windows Executable Recompilation

**Files:**
- Output: `tienda-pos/build/bin/iLuz.exe`

- [ ] **Step 1: Run all Go unit and integration tests**

Run: `go test -v -cover ./tienda-pos/...`  
Expected: Coverage >= 85%, all tests pass.

- [ ] **Step 2: Build frontend bundle**

Run: `npm run build` in `tienda-pos/frontend`  
Expected: Clean build with zero warnings.

- [ ] **Step 3: Recompile Windows AMD64 executable with Wails**

Run: `export PATH=$PATH:/Users/julian.porras/go/bin && wails build -platform windows/amd64 -clean` in `tienda-pos`  
Expected: `Built '.../iLuz.exe' in X.Xs`

- [ ] **Step 4: Create Walkthrough documentation**

Update `walkthrough.md` with verification steps, screenshots/diagrams, and transfer instructions.

- [ ] **Step 5: Final Git commit**

```bash
git add .
git commit -m "chore(release): complete Phase 3 implementation and build iLuz.exe"
```

---

## Verification Plan

### Automated Tests
- `go test -v -cover ./tienda-pos/...`: Validates all database transactions (suppliers, purchases, stock adjustments, negative stock, shifts, audit reconciliations, and reporting aggregations).
- `cd tienda-pos/frontend && npm run build`: Ensures zero JSX/JS syntax errors and validates Vite bundle creation.

### Manual Verification
1. **Inventory Scan Auto-Edit:** In `Inventario`, scan an existing item $\rightarrow$ `ProductModal` opens immediately pre-filled.
2. **Audit CSV Export:** Start an audit for `EST01`, register counts, finish $\rightarrow$ Click `Exportar CSV` $\rightarrow$ Dialog/file generates without crashing app.
3. **Audit Scope:** Open `Iniciar Inventario` $\rightarrow$ Verify only whole shelves are listed.
4. **Quick Products:** Mark item as quick access $\rightarrow$ Open `Caja` $\rightarrow$ Item shows in top bar; click `Ver todos` $\rightarrow$ touch grid appears.
5. **Suppliers & Purchase Intake:** Create supplier "Distribuidora X" $\rightarrow$ Open `Entradas` $\rightarrow$ Scan 3 items $\rightarrow$ Attach invoice file $\rightarrow$ Finalize $\rightarrow$ Stock and cost prices updated in catalog.
6. **Reports:** Open `Reportes` $\rightarrow$ Verify weekly/monthly/yearly sales & purchases metrics.
7. **Touch & Hotkeys:** Press <kbd>F1</kbd>-<kbd>F6</kbd> to switch modules. Verify buttons and inputs are comfortable on touchscreen.
