# iLuz - Specifications: Pure Internal Inventory & Stock Audits (Phase 1)

**Document Status**: Final Specification / Implementation Ready  
**Last Updated**: 2026-09-18  
**Scope**: Functional and architectural definition for **Day-to-Day Catalog Management** and **Multi-Day Physical Inventory Sessions (Stock Audits)**. Customer checkout / POS sales register calculations are deferred to Phase 2 (see [`TODO_CHECKOUT_INTEGRATION.md`](file:///Users/julian.porras/Documents/Personal/Projects_Organized/Projects/iLuz/tienda-pos/TODO_CHECKOUT_INTEGRATION.md)).

---

## 1. Overview & Core Distinction

The application focuses on internal inventory control and audit workflows without sales register / checkout overhead:

| Concept | Mode A: Day-to-Day Catalog Management | Mode B: Physical Inventory Session (*Toma de Inventario*) |
| :--- | :--- | :--- |
| **Active When** | No inventory session is currently open or in progress. | An inventory session has been explicitly initiated and remains open. |
| **Primary Goal** | Creating new products for the first time, editing existing items, assigning locations, updating prices, and manual stock updates. | Verifying, counting, and reconciling real-world physical shelf/bodega stock against system records. |
| **Time Horizon** | Continuous, instant edits per product. | Event-driven; can span hours or multiple days across store shifts. |
| **Database Impact** | Directly edits the `products` table (`name`, `price`, `stock`, `location`, `active`). | Records counts in dedicated audit tables (`inventory_sessions`, `inventory_session_items`, `inventory_count_entries`) without prematurely overwriting live stock. |
| **Lifecycle** | Immediate commit on save. | **Created ➔ In Progress (Multi-Day) ➔ Reconciled ➔ Closed with Selective Adjustments**. |

---

## 2. Mode A: Normal Catalog Management (Day-to-Day)

When **no inventory session is in progress**, the application provides straightforward catalog administration:

1. **First-Time Item Onboarding**:
   - The user (e.g., father creating the store's initial product catalog) scans a barcode or clicks **"Nuevo Producto"**.
   - Generates automatic internal SKUs (`INT-XXXXXX`) if a barcode is missing.
   - Allows entering initial stock, unit price, unit of measure, location, weight, and color.
2. **Day-to-Day Maintenance**:
   - Updating item descriptions, adjusting prices, reassigning physical shelf locations (`EST-A1`, `BOD-01`).
   - Archiving (`📦 Archivar`) or restoring (`♻️ Activar`) products.
   - Exporting the full inventory catalog to CSV.

> [!IMPORTANT]
> **Rule 6 — Stock Freeze During Active Audits**:
> While an audit session is `in_progress`, the `stock` input field in `ProductModal` is **disabled (read-only)** with an informative banner:
> *"🔒 Toma de inventario activa: el stock oficial se actualizará al finalizar la toma."*
> (Product name, price, description, unit of measure, and shelf location remain freely editable).

---

## 3. Mode B: Physical Inventory Session (*Toma de Inventario*)

### 3.1. Session Initiation & Snapshot Pre-population
When the user chooses **"Iniciar Nueva Toma de Inventario"**, a modal prompts for session identification metadata:

- **Nombre / Identificador del Inventario** (*Required*):
  - e.g., *"Inventario Inicial 2026"*, *"Conteo Pasillo 1 - Abarrotes"*, *"Auditoría General"*.
- **Responsable / Operador** (*Optional*):
  - Name or initials of the person performing the count.
- **Alcance / Scope** (*Required*):
  - **Toda la Tienda (`ALL`)** (All registered active products).
  - **Por Locación / Zona Específica** (Filter to items currently assigned to a selected zone/shelf, e.g., `EST-A1`).
- **Notas / Observaciones** (*Optional*):
  - Context notes (e.g., *"Conteo inicial para cuadre de existencias"*).
- **Fecha y Hora de Inicio** (Auto-generated timestamp).

#### Immediate Snapshot Creation (Pre-population)
In a single atomic transaction (`BEGIN IMMEDIATE`):
1. Creates the `inventory_sessions` header with `status = 'in_progress'`.
2. Populates `inventory_session_items` from active products matching the chosen scope.
3. Each snapshot item records:
   - `product_id` (immutable foreign key to `products.id`).
   - `barcode` & `product_name` (denormalized snapshot).
   - `system_stock_at_start = products.stock` (snapshot baseline).
   - `counted_qty = 0`.
   - `is_counted = 0` (uncounted / pending).
4. **Instant Progress Tracking**:
   - Total items to count: e.g. `350`
   - Counted so far: `0`
   - Pending count: `350` (0% complete)

---

### 3.2. Multi-Day Lifecycle & Persistence
Physical store counts often take days across multiple working sessions:

1. **Persistent State in SQLite**:
   - The session status is stored as `in_progress` in SQLite.
   - Closing `iLuz`, shutting down the computer, or rebooting **preserves all counted data**.
2. **Single Active Session Constraint**:
   - Enforced directly at the SQLite schema level via a partial unique index:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session 
     ON inventory_sessions(status) WHERE status = 'in_progress';
     ```
   - Only one session can be open at a time, preventing data collisions.
3. **Persistent Session Banner & Resume**:
   - While `in_progress`, a persistent header banner indicates:
     `🟢 Toma de Inventario Activa: "[Nombre]" — [X] de [Y] productos contados ([Z]%)`.
   - The operator can leave the view, check prices, or lookup shelf locations, and return to counting at any time.
4. **Pause & Cancel**:
   - `in_progress` **is** the paused state—no special "pause" button is needed.
   - If started by mistake, the user can click **"Cancelar Inventario"** (marks session as `cancelled`, preserves audit records for historical audit, and discards uncommitted stock changes).

---

### 3.3. Active Counting Workflow & Operational Rules

#### Rule 1 — `counted_qty` Derived from Count Entries
- `inventory_count_entries` is the **single source of truth** for physical counts.
- Every scan, batch F2, or zero count writes/updates an entry in `inventory_count_entries`.
- `counted_qty` is always synchronized in the same transaction:
  ```sql
  counted_qty = (SELECT COALESCE(SUM(qty), 0) FROM inventory_count_entries WHERE session_item_id = :id)
  is_counted  = 1
  last_counted_at = CURRENT_TIMESTAMP
  ```
- `counted_qty` is **never** incremented independently, eliminating count desync.

#### Rule 2 — Counting Location Selector in UI (Shelf + Bodega Split)
- In the counting view header, the operator has an active location selector:
  `📍 Contando en: [ Estante Principal (EST-A1) ▼ ] | [ 📦 Bodega (BOD-01) ] | [ ➕ Otra ]`
- Defaults to the product's primary location.
- When an item is stored in multiple physical areas:
  - Entry 1 (Shelf `EST-A1`): 10 units.
  - Entry 2 (Bodega `BOD-01`): 30 units.
  - Total `counted_qty` = 40 (10 + 30).
  - Both counts are recorded distinctly, preventing false shrinkage!

#### Rule 5 — Barcode Scan Scenarios & Ergonomics
1. **Registered Product in Snapshot**:
   - Barcode scan adds +1 unit to the entry for the currently selected counting location.
   - Audio chime and green highlight feedback.
2. **Batch Entry (`F2`)**:
   - Typing a number (e.g. `48`) **replaces** the quantity for the currently selected location, avoiding double-counting after manual checks.
3. **Undo Last Scan / Decrement**:
   - An "Undo" button (or `-1` action) allows quickly reverting an accidental scan if the barcode reader double-fires.
4. **Explicit Zero Count**:
   - For an empty shelf, clicking "Contar 0" sets `counted_qty = 0` and `is_counted = 1`, distinguishing verified zeros from uncounted items.
5. **Unknown Barcode Scanned During Audit**:
   - Prompts: *"Código no registrado en el catálogo. ¿Deseas darlo de alta?"*
   - Opens quick product registration -> creates real product in `products` (obtaining an immutable `products.id`), then appends it to `inventory_session_items` with `system_stock_at_start = 0` and `counted_qty = 1`.
6. **Out-of-Scope Product Scanned**:
   - If auditing only zone `EST-A1` and a product from `EST-B2` is scanned, prompts: *"Este producto pertenece a otra zona. ¿Deseas agregarlo a este inventario?"*

#### Rule 3 — Correct Predicate for Quick Filters
The counting screen provides 4 filter tabs:
- **Todos** (all items in scope).
- **Pendientes por contar**: `is_counted = 0`.
- **Ya contados**: `is_counted = 1`.
- **Con diferencias**: `is_counted = 1 AND counted_qty != system_stock_at_start`.
  *(Items with `is_counted = 0` are excluded from the difference filter so uncounted items are not falsely classified as discrepancies)*.

---

### 3.4. Finalization & Reconciliation Screen (*Cierre de Inventario*)
When physical counting is complete, the user clicks **"🏁 Finalizar Inventario"**:

#### 1. Reconciliation Table
- Columns displayed:
  - **Código & Nombre del Producto**
  - **Ubicación Principal**
  - **Detalle por Ubicaciones**: Breakdown (e.g., `EST-A1: 10, BOD-01: 30`)
  - **Stock en Sistema (Inicial)**: `system_stock_at_start`
  - **Conteo Físico (Real)**: `counted_qty`
  - **Diferencia / Varianza (+/-)**: `counted_qty - system_stock_at_start`
  - **Impacto Financiero ($)**: $\text{Diferencia} \times \text{Precio Unitario Inicial}$
  - **Ajustar en BD**: Individual checkbox `[x]` per item.

#### 2. Selective Stock Adjustments & Uncounted Item Safety
- Master toolbar actions:
  - **"Seleccionar sólo productos con diferencias"** (Applies predicate: `is_counted = 1 AND counted_qty != system_stock_at_start`).
  - **"Seleccionar todos los contados"**.
  - **"Desmarcar todos"** (Audit-only report mode).

> [!CAUTION]
> **Safety Guardrail for Uncounted Products (`is_counted = 0`)**:
> Products that were never physically counted remain with `is_counted = 0`. Their adjustment checkbox is **disabled and unchecked by default**. Finishing an audit **never zeroes out uncounted products**!

#### Rule 7 — Zone-Scoped Audit Guardrail
If `scope != 'ALL'`, an alert modal warns before closing:
> *"⚠️ Esta toma corresponde a una zona específica (%s). Recuerda que el stock del sistema representa el total de la tienda (estante + bodega). Asegúrate de haber registrado todas las ubicaciones antes de sobreescribir el stock."*

#### Rule 4 — Closing Execution & Traceability (`adjustment_applied`, `stock_after`)
Inside a single database transaction (`BEGIN IMMEDIATE`):
1. Asserts session is `in_progress` (idempotent; prevents duplicate closing).
2. For every **checked** product (where `is_counted = 1`):
   ```sql
   UPDATE products SET stock = :counted_qty WHERE id = :product_id;
   UPDATE inventory_session_items 
      SET adjustment_applied = 1, stock_after = :counted_qty 
    WHERE id = :item_id;
   ```
3. For **unchecked** products: Live stock remains untouched, and records:
   ```sql
   UPDATE inventory_session_items 
      SET adjustment_applied = 0, stock_after = NULL 
    WHERE id = :item_id;
   ```
4. Sets `inventory_sessions.status = 'completed'` and `closed_at = CURRENT_TIMESTAMP`.
5. Emits `product:updated` to refresh all catalog views instantly.

#### 4. Audit CSV Export
- Button **"💾 Exportar Reporte de Auditoría a CSV"**: Exports an Excel-ready report with all initial snapshot stocks, counted amounts, per-location breakdown, variances, financial discrepancies, and `adjustment_applied` status.

---

## 4. SQLite Schema Design (Phase 1)

```sql
-- 1. Inventory Sessions Master Table
CREATE TABLE IF NOT EXISTS inventory_sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    responsible   TEXT NOT NULL DEFAULT '',
    scope         TEXT NOT NULL DEFAULT 'ALL', -- 'ALL' or location code
    notes         TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    started_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at     DATETIME
);

-- Rule: Exactly ONE active session allowed at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session 
ON inventory_sessions(status) WHERE status = 'in_progress';

-- 2. Audit Session Items (Pre-populated Snapshot & Permanent Audit Trace)
CREATE TABLE IF NOT EXISTS inventory_session_items (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id            INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    product_id            INTEGER NOT NULL REFERENCES products(id),
    barcode               TEXT NOT NULL,
    product_name          TEXT NOT NULL,
    location              TEXT NOT NULL DEFAULT '',
    unit_price            REAL NOT NULL DEFAULT 0.0,
    system_stock_at_start INTEGER NOT NULL DEFAULT 0, -- Snapshot baseline
    counted_qty           INTEGER NOT NULL DEFAULT 0, -- Derived sum of entries
    is_counted            INTEGER NOT NULL DEFAULT 0, -- 0 = pending, 1 = counted
    last_counted_at       DATETIME,
    adjustment_applied    INTEGER NOT NULL DEFAULT 0, -- Rule 4: 1 = updated live stock, 0 = skipped
    stock_after           INTEGER,                    -- Rule 4: final stock value written (or NULL)
    notes                 TEXT NOT NULL DEFAULT '',
    UNIQUE(session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_items_session ON inventory_session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_counted ON inventory_session_items(session_id, is_counted);

-- 3. Multi-Location Count Entries (Rule 1 & 2: Shelf + Bodega accumulator)
CREATE TABLE IF NOT EXISTS inventory_count_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_item_id INTEGER NOT NULL REFERENCES inventory_session_items(id) ON DELETE CASCADE,
    location_code   TEXT NOT NULL DEFAULT '', -- e.g. 'EST-A1', 'BODEGA'
    qty             INTEGER NOT NULL CHECK (qty >= 0),
    counted_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_count_entries_item ON inventory_count_entries(session_item_id);
```

---

## 5. Summary of the 7 Operational Rules

| Rule | Area | Operational Value |
| :--- | :--- | :--- |
| **Rule 1** | **Derived `counted_qty`** | $\text{counted\_qty} = \sum \text{entries}$; never desynchronizes. |
| **Rule 2** | **Location Selector** | UI toggle (`EST-A1` vs `BODEGA`) to cleanly record split inventory. |
| **Rule 3** | **Difference Predicate** | `is_counted = 1 AND counted != system_stock`; uncounted items are never marked as differences. |
| **Rule 4** | **Audit Traceability** | `adjustment_applied` and `stock_after` permanently record in DB & CSV what was written. |
| **Rule 5** | **Scan Ergonomics** | Unknown barcode creates real product first; F2 replaces location count; Undo reverses double-scans. |
| **Rule 6** | **Catalog Stock Freeze** | Direct stock edits in `ProductModal` disabled while audit is `in_progress`. |
| **Rule 7** | **Zone Guardrail** | Warning on single-zone audits to prevent accidentally erasing bodega stock. |
