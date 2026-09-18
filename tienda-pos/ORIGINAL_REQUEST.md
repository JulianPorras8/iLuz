# Original User Request

## 2026-09-14T10:19:28-05:00

Migrate the TiendaPOS desktop application frontend from a single imperative HTML/JS file to a modular React + Vite architecture (pure JavaScript and `.jsx`, zero TypeScript overhead) embedded into the Wails v2 Go binary, resolving stale state updates and window click-unresponsiveness.

Working directory: /Users/julian.porras/Documents/Personal/Projects_Organized/Projects/iLuz/tienda-pos
Integrity mode: demo

## Requirements

### R1. React + Vite Frontend Scaffolding (Pure JS + JSX)
Scaffold and configure a lightweight Vite + React project using pure JavaScript and `.jsx` (no TypeScript) in `tienda-pos/frontend`, configured to build into the distribution directory embedded by the Go Wails v2 backend (`frontend/dist`).

### R2. Modular Component Architecture & Reactive State
Migrate the existing four application areas into dedicated components (`POSView`, `PositioningView`, `InventoryView`, `LocationsView`, `ProductModal`, `Header`), ensuring all product status and inventory updates reflect reactively and instantaneously across all views without requiring app restarts.

### R3. Safe In-App Modals & WebView2 Focus Retention
Eliminate click-trapping backdrop overlays by conditionally mounting modals (`{isOpen && <Modal />}`) and supporting backdrop click and Escape key dismissals. Replace native blocking dialogs (`confirm(...)`) with an in-app confirmation modal, and ensure window focus is retained after file dialogs.

### R4. Hardware Scanner & SQLite Synchronization
Preserve serial COM port scanner event routing from the Go backend (`barcode:scanned`, `scanner:status`) and synchronize real-time updates with the React state store. Fix the `active` logic in `db.go` so `Active = false` is always respected during saves.

## Acceptance Criteria

### Build & Integration
- [ ] `npm run build` inside `frontend/` succeeds without errors, outputting production assets to `dist/`.
- [ ] `wails build -platform windows/amd64` successfully compiles `tienda-pos.exe` embedding the React bundle.
- [ ] All Go unit tests (`go test -count=1 -v ./...`) pass cleanly.

### Functional & UI Behavior
- [ ] Inactivating or reactivating an item immediately toggles its status pill and button in the inventory table without delay or restart.
- [ ] Modals unmount cleanly upon cancel, save, backdrop click, or Escape key, leaving zero unresponsive click zones.
- [ ] Barcode scans route seamlessly to the active tab (POS, Positioning, Inventory).
- [ ] Location deletion uses an in-app confirmation modal, eliminating WebView2 OS focus loss.

## 2026-09-18T20:30:22Z

Please resume execution of Milestone 2: Frontend React + Vite scaffolding and modular component implementation.
