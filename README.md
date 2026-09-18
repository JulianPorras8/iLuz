# ⚡ iLuz

> **Fast, offline-first desktop application for retail inventory management, multi-location physical stock audits, and barcode scanning with Go, Wails v2, SQLite, and React 18.**

---

## 📖 Overview

**iLuz** is a lightweight, local-first Windows desktop application tailored for internal store inventory management, item positioning, and multi-day physical stock audits. Built with a pure-Go backend and a responsive React frontend embedded in a single self-contained executable, it operates completely offline with zero cloud dependency.

---

## ✨ Key Features

### 1. Catalog & Location Management (Mode A)
- **First-time Product Onboarding**: Register products with barcode, name, unit price, stock, unit of measure, dimensions, color, and location.
- **Internal Barcode Autogeneration**: Products without physical barcodes automatically receive unique `INT-XXXXXX` identifiers.
- **Physical Positioning**: Assign and re-assign items to physical store shelves or storage zones (`EST-A1`, `BOD-01`, etc.).
- **Non-destructive Archiving**: Toggle products between active and archived states without data loss.

### 2. Physical Stock Audits (Mode B - Toma de Inventario)
- **Multi-Day Session Persistence**: Sessions survive PC reboots and app closures. Store owners can count over days at their own pace.
- **Snapshot Pre-population**: At audit start, system stock is frozen as a baseline to accurately compute variances.
- **Multi-Location Counting (Rule 1 & 2)**: Counts across multiple locations (shelf + bodega) accumulate cleanly without overwriting.
- **Uncounted Item Safety (Rule 4)**: Products that were not counted (`is_counted = 0`) are never zeroed out on session close.
- **Catalog Stock Freeze (Rule 6)**: While an audit is in progress, direct catalog stock modifications are locked to prevent concurrency anomalies.
- **Selective Reconciliation**: Side-by-side comparison table with variance metrics, financial impact estimation, and selective checkbox updates before committing changes.
- **Audit Reports**: Instant export of detailed CSV audit reports with Microsoft Excel UTF-8 BOM compatibility.

### 3. Hardware Barcode Scanner Integration
- **Honeywell Orbit MS7120 Support**: Background Go worker automatically detects, opens, and auto-reconnects to the scanner's COM serial port (9600 baud, 8N1).
- **USB Keyboard Wedge Fallback**: Global keystroke buffer handles standard USB HID barcode scanners seamlessly.
- **Scanner Ergonomics**: Synthesizer audio chime via Web Audio API, quick batch count (`F2`), and undo (`↺`) for accidental scans.
- **Configuration Barcode Sheets**: Includes printable HTML reset sheets (`orbit_usb_serial_setup.html` and `orbit_usb_keyboard_reset.html`) to configure Honeywell Orbit scanners.

### 4. Preserved POS Checkout Integration
- Complete architectural blueprint in [`TODO_CHECKOUT_INTEGRATION.md`](tienda-pos/TODO_CHECKOUT_INTEGRATION.md) for future POS sales cashiering, cash drawers, and live sales variance reconciliation.

---

## 🛠️ Tech Stack

- **Backend**: [Go 1.21+](https://go.dev/) with [Wails v2](https://wails.io/)
- **Storage**: SQLite 3 in WAL mode via [`modernc.org/sqlite`](https://gitlab.com/cznic/sqlite) (100% pure Go, CGO-free)
- **Frontend**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) (pure JavaScript and JSX)
- **Hardware Communication**: [`go.bug.st/serial`](https://github.com/bugst/go-serial) for RS-232 / USB Serial COM ports

---

## 🚀 Getting Started

### Prerequisites
- [Go 1.21+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/) & `npm`
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation):
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

### Development Mode (Live Reload)
```bash
cd tienda-pos
wails dev
```

### Run Automated Tests
```bash
cd tienda-pos
go test -count=1 -v ./...
```

### Build Single Windows Executable
Cross-compile a standalone Windows x64 `.exe` directly from macOS/Linux:
```bash
cd tienda-pos
wails build -platform windows/amd64 -clean
```
The compiled output is generated at `tienda-pos/build/bin/iLuz.exe`.

---

## 📂 Project Structure

```text
iLuz/
├── README.md                           # Main documentation
├── SPEC.md                             # Initial architectural specification
├── tienda-pos/
│   ├── main.go                         # Wails v2 entrypoint & asset embed
│   ├── app.go                          # Backend controller methods exposed to UI
│   ├── db.go                           # SQLite schema, pragmas & atomic queries
│   ├── scanner.go                      # Honeywell Orbit serial COM port worker
│   ├── db_test.go                      # Comprehensive automated test suite
│   ├── SPECIFICATIONS_INVENTORY_AUDIT.md # Mode A & Mode B audit specifications
│   ├── TODO_CHECKOUT_INTEGRATION.md    # POS integration blueprint
│   ├── orbit_usb_serial_setup.html     # Printable Honeywell barcode setup guide
│   ├── orbit_usb_keyboard_reset.html   # Printable keyboard wedge reset guide
│   └── frontend/
│       ├── package.json                # React 18 + Vite dependencies
│       └── src/
│           ├── App.jsx                 # Top-level state coordinator
│           └── components/
│               ├── Header.jsx          # Top navigation & active audit banner
│               ├── InventoryView.jsx   # Catalog management & product search
│               ├── PositioningView.jsx # Physical location assignment
│               ├── LocationsView.jsx   # Store zones & shelves manager
│               ├── StockAuditView.jsx  # Physical inventory audit dashboard
│               ├── StartAuditModal.jsx # Audit session creation
│               ├── AuditReconciliationModal.jsx # Reconciliation & adjustments
│               ├── ProductModal.jsx    # Product creator / editor with stock freeze
│               ├── LocationModal.jsx   # Location creator / editor
│               └── ConfirmModal.jsx    # In-app confirmation dialog
```

---

## 📄 License

Internal store and inventory operations software developed by Julian Porras.
