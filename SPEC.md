# Software Design Document & Scaffolding Spec: TiendaPOS (Wails v2 + Go + SQLite)

## 1. Project Overview
Aplicación de escritorio liviana para punto de venta y control de inventario local-first orientada a Windows x64.
- **Backend:** Go 1.21+ con Wails v2.
- **Persistencia:** SQLite local embebido (`modernc.org/sqlite`, 100% Go, sin requerir CGO) en modo WAL.
- **Hardware:** Lector de código de barras omnidireccional Honeywell MS7120 conectado por emulación USB Serial (`COM3` a 9600 baudios, 8N1).
- **Frontend:** HTML5, Tailwind CSS y Vanilla JS reactivo (o framework preferido) integrado con el runtime de eventos de Wails.

---

## 2. Directory Structure to Scaffold

```text
tienda-pos/
├── build/
│   └── appicon.png
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.js
│   │   └── style.css
│   └── package.json
├── app.go
├── db.go
├── scanner.go
├── main.go
├── go.mod
├── wails.json
└── README.md
