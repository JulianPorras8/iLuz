# iLuz - Roadmap & Architecture: Future POS Checkout Integration (Phase 2)

**Document Status**: Future Roadmap / Architectural Blueprint  
**Last Updated**: 2026-09-18  
**Scope**: Technical blueprint for introducing active POS sales register / customer checkout into `iLuz` while preserving physical inventory audit integrity.

---

## 1. Context & Phased Strategy

- **Phase 1 (Current Active Scope)**:
  - `iLuz` is dedicated strictly to **internal inventory management** for the store owner.
  - Initial product onboarding, barcode scanning, shelf/bodega location assignments, price and stock tracking.
  - Multi-day physical inventory audits (*Toma de Inventario*) with pre-populated snapshots, multi-location counts (shelf + bodega), uncounted item safety, selective reconciliation, and CSV export.
  - No customer checkout or sales register calculations.

- **Phase 2 (When Customer Checkout is Activated)**:
  - Activates the `Caja / POS` customer checkout register.
  - Introduces transactional sale commits, receipt numbers, payment methods, and live stock decrements.
  - Connects sales to the physical inventory audit engine through a unified movement ledger so store sales during an audit do not cause false shrinkage.

---

## 2. Technical Architecture for Phase 2

### 2.1. Transactional Sale Persistence in SQLite
Currently, the sales cart in `POSView.jsx` operates solely in React memory. For Phase 2, checkout will execute an atomic database transaction (`BEGIN IMMEDIATE` in Go):

```sql
-- 1. Sales Header
CREATE TABLE IF NOT EXISTS sales (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number  TEXT UNIQUE NOT NULL,      -- e.g. TIK-20260918-0001
    total_amount   REAL NOT NULL DEFAULT 0.0,
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'credit')),
    amount_paid    REAL NOT NULL DEFAULT 0.0,
    change_due     REAL NOT NULL DEFAULT 0.0,
    notes          TEXT NOT NULL DEFAULT '',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

-- 2. Sales Item Lines
CREATE TABLE IF NOT EXISTS sale_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    barcode     TEXT NOT NULL,
    qty         INTEGER NOT NULL CHECK (qty > 0),
    unit_price  REAL NOT NULL,
    subtotal    REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
```

---

### 2.2. Unified Stock Movements Ledger
Every event that changes stock (sales, customer returns, supplier deliveries, audit adjustments) must write to a signed movement ledger:

```sql
CREATE TABLE IF NOT EXISTS stock_movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    qty         INTEGER NOT NULL, -- Signed integer: -sale, +return, +receipt, +count_adjust
    reason      TEXT NOT NULL CHECK (reason IN ('sale', 'return', 'receipt', 'count_adjust', 'manual_adjust')),
    source_id   INTEGER,          -- Links to sales.id or inventory_sessions.id
    notes       TEXT NOT NULL DEFAULT '',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movements_prod_date ON stock_movements(product_id, created_at);
```

---

### 2.3. Timestamp-Aware Sales Reconciliation During Open Audits
If a physical inventory audit spans 2–3 days while customer checkout is active, the system solves the timing problem identified by Grok by splitting movements around `last_counted_at`:

1. **Movements Before Physical Count**:
   $$\text{Movements}_{\text{before}} = \sum \text{qty} \quad (\text{where } \text{created\_at} \le \text{last\_counted\_at})$$
2. **Movements After Physical Count**:
   $$\text{Movements}_{\text{after}} = \sum \text{qty} \quad (\text{where } \text{created\_at} > \text{last\_counted\_at})$$
3. **Variance Calculation (At Count Moment)**:
   $$\text{Expected Stock at Count} = \text{system\_stock\_at\_start} + \text{Movements}_{\text{before}}$$
   $$\text{Variance} = \text{counted\_qty} - \text{Expected Stock at Count}$$
4. **Calculated Live Stock on Session Close**:
   $$\text{New Live Stock to Write} = \text{counted\_qty} + \text{Movements}_{\text{after}}$$

#### Operational Example:
* Product X has 20 units at session start.
* Operator counts **20 units** on Day 1 (`last_counted_at = Day 1`).
* POS sells **4 units** on Day 2 (`qty = -4`, `created_at > last_counted_at`). Live database stock is 16.
* **On Close**:
  * $\text{Variance} = 20 - (20 + 0) = \mathbf{0}$ (Zero false shrinkage!).
  * $\text{New Live Stock} = 20 + (-4) = \mathbf{16}$ (Accurately reflects the 4 units sold!).

---

### 2.4. Customer Returns & Supplier Receipts
- **Customer Returns / Refunds**:
  - Increments live stock: `UPDATE products SET stock = stock + :qty`.
  - Inserts into `stock_movements`: `qty = +qty`, `reason = 'return'`.
  - Automatically treated as positive movement in audit calculations.
- **Supplier Receipts / Deliveries**:
  - Increments live stock: `UPDATE products SET stock = stock + :qty`.
  - Inserts into `stock_movements`: `qty = +qty`, `reason = 'receipt'`.

---

### 2.5. POS Checkout UX Enhancements for Phase 2
1. **Payment Modal**:
   - Fast numeric keypad for tender amount: Cash, Bancolombia/Nequi transfer, Card.
   - Automatic change due calculation.
2. **Receipt / Ticket Formatter**:
   - Clean 58mm / 80mm thermal receipt format (ESC/POS or standard Windows print).
3. **Daily Cash Closing (*Cierre de Caja / Arqueo*)**:
   - Total cash sales vs card/transfer sales for the shift/day.
   - Starting cash float + cash collected = expected drawer cash.

---

## 3. Phase 2 Implementation Checklist

When the business is ready to activate customer sales:

- [ ] Run SQLite migration for `sales`, `sale_items`, and `stock_movements`.
- [ ] Add Go backend methods in `app.go`:
  - `CompleteSale(saleData)` (atomic `BEGIN IMMEDIATE` executing stock decrement + movements).
  - `GetDailySalesReport(date)`
  - `ProcessProductReturn(saleId, productId, qty)`
- [ ] Connect React `POSView.jsx` to `CompleteSale` with payment tender modal.
- [ ] Update `inventory_session_items` reconciliation to calculate the timestamp-split formula.
- [ ] Add receipt printing option.
