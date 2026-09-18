#!/usr/bin/env bash
set -e

PROJECT_DIR="tienda-pos"
mkdir -p "$PROJECT_DIR/frontend"
mkdir -p "$PROJECT_DIR/build"

cd "$PROJECT_DIR"

# 1. wails.json (Configuración de Wails v2 sin Vite/Node, sirviendo assets directos)
cat << 'EOF' > wails.json
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "tienda-pos",
  "outputfilename": "tienda-pos",
  "author": {
    "name": "Tienda POS"
  }
}
EOF

# 2. go.mod
cat << 'EOF' > go.mod
module tienda-pos

go 1.21

require (
	github.com/wailsapp/wails/v2 v2.8.2
	go.bug.st/serial v1.6.2
	modernc.org/sqlite v1.29.5
)
EOF

# 3. db.go (SQLite en modo WAL sin CGO)
cat << 'EOF' > db.go
package main

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

type Product struct {
	ID      int64   `json:"id"`
	Barcode string  `json:"barcode"`
	Name    string  `json:"name"`
	Price   float64 `json:"price"`
	Stock   int     `json:"stock"`
}

func initDB(filepath string) *sql.DB {
	db, err := sql.Open("sqlite", filepath)
	if err != nil {
		log.Fatalf("Error abriendo SQLite: %v", err)
	}

	pragmas := `
	PRAGMA journal_mode = WAL;
	PRAGMA synchronous = NORMAL;
	PRAGMA busy_timeout = 5000;
	PRAGMA foreign_keys = ON;
	`
	if _, err := db.Exec(pragmas); err != nil {
		log.Fatalf("Error aplicando PRAGMAs: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS products (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		barcode TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		price REAL NOT NULL DEFAULT 0.0,
		stock INTEGER NOT NULL DEFAULT 0
	);
	CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
	`
	if _, err := db.Exec(schema); err != nil {
		log.Fatalf("Error creando esquema: %v", err)
	}

	return db
}

func getProductByBarcode(db *sql.DB, barcode string) (*Product, error) {
	query := `SELECT id, barcode, name, price, stock FROM products WHERE barcode = ? LIMIT 1`
	row := db.QueryRow(query, barcode)

	var p Product
	err := row.Scan(&p.ID, &p.Barcode, &p.Name, &p.Price, &p.Stock)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func saveOrUpdateProduct(db *sql.DB, p Product) error {
	query := `
	INSERT INTO products (barcode, name, price, stock)
	VALUES (?, ?, ?, ?)
	ON CONFLICT(barcode) DO UPDATE SET
		name = excluded.name,
		price = excluded.price,
		stock = excluded.stock;
	`
	_, err := db.Exec(query, p.Barcode, p.Name, p.Price, p.Stock)
	return err
}

func listAllProducts(db *sql.DB) ([]Product, error) {
	rows, err := db.Query(`SELECT id, barcode, name, price, stock FROM products ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.Barcode, &p.Name, &p.Price, &p.Stock); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}
EOF

# 4. scanner.go (Escucha COM3 en segundo plano con reconexión elástica)
cat << 'EOF' > scanner.go
package main

import (
	"bufio"
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.bug.st/serial"
)

type ScanPayload struct {
	Found   bool     `json:"found"`
	Barcode string   `json:"barcode"`
	Product *Product `json:"product,omitempty"`
	Message string   `json:"message,omitempty"`
}

func startScannerWorker(ctx context.Context, db *sql.DB, comPort string) {
	mode := &serial.Mode{
		BaudRate: 9600,
		DataBits: 8,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
			port, err := serial.Open(comPort, mode)
			if err != nil {
				runtime.EventsEmit(ctx, "scanner:status", map[string]any{
					"connected": false,
					"error":     err.Error(),
				})
				time.Sleep(2 * time.Second)
				continue
			}

			runtime.EventsEmit(ctx, "scanner:status", map[string]any{
				"connected": true,
				"port":      comPort,
			})

			reader := bufio.NewReader(port)
			for {
				raw, err := reader.ReadString('\r')
				if err != nil {
					port.Close()
					break
				}

				code := strings.TrimSpace(raw)
				if code == "" {
					continue
				}

				prod, err := getProductByBarcode(db, code)
				payload := ScanPayload{Barcode: code}

				if err == sql.ErrNoRows {
					payload.Found = false
					payload.Message = "Producto no registrado"
				} else if err != nil {
					payload.Found = false
					payload.Message = "Error de base de datos"
				} else {
					payload.Found = true
					payload.Product = prod
				}

				runtime.EventsEmit(ctx, "barcode:scanned", payload)
			}
		}
	}
}
EOF

# 5. app.go (Controlador de Wails)
cat << 'EOF' > app.go
package main

import (
	"context"
	"database/sql"
)

type App struct {
	ctx context.Context
	db  *sql.DB
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.db = initDB("inventario.db")
	go startScannerWorker(a.ctx, a.db, "COM3")
}

func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

func (a *App) GetAllProducts() ([]Product, error) {
	return listAllProducts(a.db)
}

func (a *App) SaveProduct(p Product) error {
	return saveOrUpdateProduct(a.db, p)
}

func (a *App) SearchBarcode(barcode string) (*Product, error) {
	return getProductByBarcode(a.db, barcode)
}
EOF

# 6. main.go (Punto de entrada de escritorio)
cat << 'EOF' > main.go
package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:  "Tienda POS - Control de Inventario",
		Width:  1100,
		Height: 720,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
EOF

# 7. frontend/index.html (Interfaz responsiva para mostrador con runtime nativo de Wails)
cat << 'EOF' > frontend/index.html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tienda POS</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #f1f5f9; color: #0f172a; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    header { background-color: #1e293b; color: #fff; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
    .badge { padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
    .badge-off { background-color: #ef4444; color: #fff; }
    .badge-on { background-color: #10b981; color: #fff; }
    main { flex: 1; display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px; overflow: hidden; }
    .panel { background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 16px; }
    .panel-title { font-size: 16px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 12px; }
    .table-container { flex: 1; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 8px; font-size: 12px; color: #64748b; border-bottom: 1px solid #cbd5e1; }
    td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .footer-total { display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #e2e8f0; padding-top: 14px; margin-top: 10px; }
    .total-price { font-size: 28px; font-weight: 800; color: #059669; }
    .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 13px; }
    .btn-clear { background-color: #e2e8f0; color: #334155; }
    .btn-clear:hover { background-color: #cbd5e1; }
    .btn-save { background-color: #2563eb; color: #fff; width: 100%; margin-top: 8px; }
    .btn-save:hover { background-color: #1d4ed8; }
    .card-active { border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; background: #fafafa; }
    .card-active h3 { font-size: 20px; margin: 8px 0; }
    .card-price { font-size: 32px; font-weight: 800; color: #1e293b; }
    .form-group { margin-bottom: 10px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
    .form-group input { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <header>
    <h2>Terminal de Venta e Inventario</h2>
    <div id="status-badge" class="badge badge-off">
      <span id="status-text">Buscando Orbit en COM3...</span>
    </div>
  </header>

  <main>
    <section class="panel">
      <div class="panel-title">Lista de Productos Escaneados</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>DESCRIPCIÓN</th>
              <th>PRECIO</th>
              <th>CANT.</th>
              <th>SUBTOTAL</th>
            </tr>
          </thead>
          <tbody id="cart-rows"></tbody>
        </table>
      </div>
      <div class="footer-total">
        <button class="btn btn-clear" id="btn-clear">Limpiar Venta</button>
        <div>
          <span style="font-size: 14px; color: #64748b;">Total a Cobrar:</span>
          <span class="total-price" id="total-val">$0.00</span>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">Último Producto Escaneado</div>
      <div id="active-card" class="card-active">
        <p style="color: #94a3b8;">Pasa un producto frente al lector...</p>
      </div>

      <form id="new-product-form" class="hidden" style="margin-top: 14px;">
        <div class="form-group">
          <label>Código de Barras</label>
          <input type="text" id="np-barcode" readonly style="background: #f1f5f9; font-family: monospace;" />
        </div>
        <div class="form-group">
          <label>Nombre del Producto</label>
          <input type="text" id="np-name" required placeholder="Ej: Arroz Diana 500g" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Precio</label>
            <input type="number" id="np-price" step="0.01" required placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>Stock Inicial</label>
            <input type="number" id="np-stock" required value="10" />
          </div>
        </div>
        <button type="submit" class="btn btn-save">Guardar e Ingresar</button>
      </form>
    </section>
  </main>

  <script>
    let cart = [];

    document.addEventListener("DOMContentLoaded", () => {
      const badge = document.getElementById("status-badge");
      const badgeText = document.getElementById("status-text");
      const activeCard = document.getElementById("active-card");
      const form = document.getElementById("new-product-form");

      window.runtime.EventsOn("scanner:status", (status) => {
        if (status.connected) {
          badge.className = "badge badge-on";
          badgeText.textContent = "Orbit Conectado (" + status.port + ")";
        } else {
          badge.className = "badge badge-off";
          badgeText.textContent = "Reconectando COM3...";
        }
      });

      window.runtime.EventsOn("barcode:scanned", (data) => {
        if (data.found) {
          form.classList.add("hidden");
          addToCart(data.product);
          renderActive(data.product);
        } else {
          showRegisterForm(data.barcode);
        }
      });

      function addToCart(p) {
        const item = cart.find(i => i.id === p.id);
        if (item) {
          item.qty += 1;
        } else {
          cart.push({ ...p, qty: 1 });
        }
        renderCart();
      }

      function renderCart() {
        const tbody = document.getElementById("cart-rows");
        tbody.innerHTML = "";
        let total = 0;
        cart.forEach(item => {
          const sub = item.price * item.qty;
          total += sub;
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="font-family: monospace; color: #64748b;">${item.barcode}</td>
            <td style="font-weight: 600;">${item.name}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>${item.qty}</td>
            <td style="font-weight: 700;">$${sub.toFixed(2)}</td>
          `;
          tbody.appendChild(tr);
        });
        document.getElementById("total-val").textContent = `$${total.toFixed(2)}`;
      }

      function renderActive(p) {
        activeCard.innerHTML = `
          <div style="color: #059669; font-weight: 700; font-size: 12px;">PRODUCTO REGISTRADO</div>
          <h3>${p.name}</h3>
          <div style="font-family: monospace; color: #64748b; font-size: 13px;">${p.barcode}</div>
          <div class="card-price">$${p.price.toFixed(2)}</div>
          <div style="color: #64748b; font-size: 12px; margin-top: 4px;">Stock: ${p.stock}</div>
        `;
      }

      function showRegisterForm(code) {
        activeCard.innerHTML = `
          <div style="color: #d97706; font-weight: 700; font-size: 12px;">CÓDIGO NO REGISTRADO</div>
          <h3 style="font-family: monospace;">${code}</h3>
          <p style="color: #64748b; font-size: 12px;">Ingresa los datos para guardarlo</p>
        `;
        document.getElementById("np-barcode").value = code;
        form.classList.remove("hidden");
        document.getElementById("np-name").focus();
      }

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const p = {
          barcode: document.getElementById("np-barcode").value,
          name: document.getElementById("np-name").value,
          price: parseFloat(document.getElementById("np-price").value),
          stock: parseInt(document.getElementById("np-stock").value, 10)
        };
        await window.go.main.App.SaveProduct(p);
        form.reset();
        form.classList.add("hidden");
        const fresh = await window.go.main.App.SearchBarcode(p.barcode);
        addToCart(fresh);
        renderActive(fresh);
      });

      document.getElementById("btn-clear").addEventListener("click", () => {
        cart = [];
        renderCart();
      });
    });
  </script>
</body>
</html>
EOF

# Descargar módulos de Go
go mod tidy

echo "==> Proyecto TiendaPOS generado exitosamente en ./$PROJECT_DIR"
