# Importación de Catálogo Excel/CSV y Emparejamiento Inteligente de Códigos de Barras

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a los dueños de la tienda importar masivamente su inventario actual desde un archivo Excel o CSV (aunque no tenga códigos de barras), asignando identificadores internos automáticos y habilitando un flujo de "Pistoleo y Emparejamiento Inteligente" en 1 clic para vincular códigos de barras físicos sobre la marcha sin reescribir datos.

**Architecture:** 
- Backend Go / SQLite: Ingesta transaccional en lote con generador de secuencias de códigos internos (`INT-000001` o correlativo) y método atómico de reasignación/vinculación de código de barras (`LinkProductBarcode`).
- Frontend React: Parser universal CSV/Excel (detección automática de delimitadores `,` y `;` y mapeo heurístico de columnas), modal de importación con vista previa (`ImportCatalogModal.jsx`) y asistente flotante de vinculación inmediata al escanear (`BarcodeMatchModal.jsx`).

**Tech Stack:** Go 1.22, SQLite WAL (`modernc.org/sqlite`), Wails v2, React 18, Vite.

**Spec:** [docs/ROADMAP_FASE_3_POS_INVENTARIO.md](file:///Users/julian.porras/Documents/Personal/Projects_Organized/Projects/iLuz/docs/ROADMAP_FASE_3_POS_INVENTARIO.md)

## Global Constraints
- Cobertura de sentencias en Go strictly $\ge 90.0\%$.
- Cero dependencias externas npm pesadas para parseo básico (usar parser ligero nativo o FileReader/PapaParse micro).
- Idempotencia: No duplicar registros si el usuario sube el archivo varias veces con la misma información.
- Atajos y ergonomía: Permitir emparejamiento con el escáner tanto en la vista de Caja (POS) como en Inventario en $\le 2$ clics.

---

### Task 1: Go Backend - Ingesta Masiva y Generador de Códigos Internos

**Files:**
- Modify: `tienda-pos/db.go:40-100`, `tienda-pos/app.go:50-100`
- Test: `tienda-pos/db_test.go`, `tienda-pos/app_test.go`

**Interfaces:**
- Produces:
  ```go
  type ProductImportItem struct {
      Barcode       string  `json:"barcode"`
      Name          string  `json:"name"`
      CostPrice     float64 `json:"costPrice"`
      Price         float64 `json:"price"`
      Stock         int     `json:"stock"`
      UnitOfMeasure string  `json:"unitOfMeasure"`
      Location      string  `json:"location"`
      IsQuickAccess bool    `json:"isQuickAccess"`
  }

  type ImportResult struct {
      Inserted int      `json:"inserted"`
      Updated  int      `json:"updated"`
      Skipped  int      `json:"skipped"`
      Total    int      `json:"total"`
      Errors   []string `json:"errors"`
  }

  func importProductsBatchTx(db *sql.DB, items []ProductImportItem, updateExisting bool) (*ImportResult, error)
  ```

- [ ] **Step 1: Escribir test unitario de ingesta masiva en `db_test.go`**

```go
func TestImportProductsBatchTx(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	items := []ProductImportItem{
		{Name: "Arroz Diana 500g", Price: 2600, CostPrice: 2100, Stock: 20}, // Sin código -> debe generar INT-XXXXXX
		{Barcode: "770123456789", Name: "Aceite Premier 1L", Price: 9500, CostPrice: 8000, Stock: 10},
		{Name: "Pan Rollo", Price: 500, CostPrice: 350, Stock: 50, IsQuickAccess: true}, // Sin código
	}

	res, err := importProductsBatchTx(db, items, false)
	if err != nil {
		t.Fatalf("import failed: %v", err)
	}
	if res.Inserted != 3 {
		t.Errorf("expected 3 inserted, got %d", res.Inserted)
	}

	// Verificar que el arroz tiene un código interno generado
	var barcode string
	err = db.QueryRow("SELECT barcode FROM products WHERE name = 'Arroz Diana 500g'").Scan(&barcode)
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if !strings.HasPrefix(barcode, "INT-") {
		t.Errorf("expected internal barcode starting with INT-, got %s", barcode)
	}
}
```

- [ ] **Step 2: Ejecutar test para verificar que falla**

Run: `go test -v -run TestImportProductsBatchTx ./...`
Expected: FAIL (función no definida)

- [ ] **Step 3: Implementar `importProductsBatchTx` en `db.go` y exponer en `app.go`**

Implementar la lógica transaccional:
1. `BEGIN IMMEDIATE`
2. Consultar el número máximo actual de código interno `SELECT MAX(id) FROM products` para formar secuencias como `INT-000101`.
3. Validar si ya existe el código o nombre. Si existe y `updateExisting` es true, actualizar precio, costo y sumar stock; si no, omitir o insertar.
4. Generar movimiento en `stock_movements` con razón `'initial_inventory'`.
5. Exponer método Wails `ImportProductsBatch(items []ProductImportItem, updateExisting bool) (*ImportResult, error)` en `app.go`.

- [ ] **Step 4: Ejecutar test para verificar que pasa**

Run: `go test -v -run TestImportProductsBatchTx ./...`
Expected: PASS

---

### Task 2: Go Backend - Vinculación Atómica de Códigos de Barras (`LinkProductBarcode`)

**Files:**
- Modify: `tienda-pos/db.go`, `tienda-pos/app.go`
- Test: `tienda-pos/db_test.go`, `tienda-pos/app_test.go`

**Interfaces:**
- Produces:
  ```go
  func linkProductBarcodeDB(db *sql.DB, productID int64, newBarcode string) (*Product, error)
  func (a *App) LinkProductBarcode(productID int64, newBarcode string) (*Product, error)
  ```

- [ ] **Step 1: Escribir test unitario para vinculación de código en `db_test.go`**

```go
func TestLinkProductBarcodeDB(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Crear producto con código interno
	p, err := saveProductDB(db, Product{
		Barcode: "INT-000042",
		Name:    "Galletas Noel",
		Price:   1200,
		Stock:   15,
		Active:  true,
	})
	if err != nil {
		t.Fatalf("save failed: %v", err)
	}

	// Vincular a código físico
	updated, err := linkProductBarcodeDB(db, p.ID, "7702001122334")
	if err != nil {
		t.Fatalf("link barcode failed: %v", err)
	}
	if updated.Barcode != "7702001122334" {
		t.Errorf("expected new barcode 7702001122334, got %s", updated.Barcode)
	}

	// Probar colisión: no debe permitir vincular un código que ya tiene otro producto activo
	_, err = linkProductBarcodeDB(db, 9999, "7702001122334")
	if err == nil {
		t.Errorf("expected collision error for duplicate barcode, got nil")
	}
}
```

- [ ] **Step 2: Ejecutar test para verificar que falla**

Run: `go test -v -run TestLinkProductBarcodeDB ./...`
Expected: FAIL

- [ ] **Step 3: Implementar `linkProductBarcodeDB` en `db.go` y `LinkProductBarcode` en `app.go`**

Validar que el código no esté vacío, comprobar que no exista en otro producto con `SELECT id, name FROM products WHERE barcode = ? AND id != ?`, actualizar el registro y retornar el producto.

- [ ] **Step 4: Ejecutar suite de pruebas de Go y verificar cobertura $\ge 90.0\%$**

Run: `go test -timeout 45s -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | tail -n 1`
Expected: Cobertura $\ge 90.0\%$, todos los tests pasando.

---

### Task 3: Frontend Parser - Mapeador Inteligente CSV y Detección Heurística

**Files:**
- Create: `tienda-pos/frontend/src/services/csvParser.js`
- Modify: `tienda-pos/frontend/src/services/apiAdapter.js`

**Interfaces:**
- Produces:
  ```javascript
  export function parseCSVContent(text): { headers: string[], rows: object[] }
  export function detectColumnMapping(headers: string[]): { nameCol, priceCol, costCol, stockCol, barcodeCol, locationCol }
  export function transformToImportItems(rows: object[], mapping: object): ProductImportItem[]
  ```

- [ ] **Step 1: Implementar `csvParser.js` con soporte para delimitadores `,` y `;`**

1. Detección automática del separador (contar ocurrencias de `;` vs `,` en las primeras líneas).
2. Limpieza de caracteres de escape y comillas (`"..."`).
3. Algoritmo heurístico para mapear nombres de columnas comunes en español e inglés:
   - Nombre: `nombre`, `producto`, `descripcion`, `articulo`, `item`
   - Precio Venta: `precio`, `venta`, `pvp`, `valor`, `precio venta`
   - Costo: `costo`, `compra`, `cost`, `costo unitario`
   - Stock: `stock`, `cantidad`, `cant`, `existencia`, `inventario`
   - Código: `codigo`, `cod`, `barra`, `barcode`, `plu`
4. Sanitización de precios y cantidades en pesos colombianos (manejo de `$`, comas de miles y puntos decimales).

- [ ] **Step 2: Exponer llamadas en `apiAdapter.js`**

Agregar `importProductsBatch(items, updateExisting)` y `linkProductBarcode(productId, barcode)` delegando a Wails o a almacenamiento local / LAN según la plataforma.

---

### Task 4: Frontend Component - Modal de Importación Masiva (`ImportCatalogModal.jsx`)

**Files:**
- Create: `tienda-pos/frontend/src/components/ImportCatalogModal.jsx`
- Modify: `tienda-pos/frontend/src/components/InventoryView.jsx`
- Modify: `tienda-pos/frontend/src/App.jsx`

**Interfaces:**
- Props: `isOpen`, `onClose`, `onImportSuccess(result)`

- [ ] **Step 1: Crear `ImportCatalogModal.jsx`**

1. Área de carga (Drag and Drop y botón "Seleccionar Archivo .CSV o .TXT").
2. Selector visual de columnas (dropdowns con mapeo detectado automáticamente pero editable por el usuario).
3. Tabla con vista previa de las primeras 5 filas para que el usuario valide antes de importar.
4. Opciones de configuración:
   - `☑ Auto-generar código interno (INT-XXXXXX) para productos sin código de barras`
   - `☑ Actualizar precios y costos si el código ya existe en el catálogo`
5. Barra de progreso / Estado de carga con resumen final (`N insertados, N actualizados, N omitidos`).

- [ ] **Step 2: Conectar en `InventoryView.jsx` y `App.jsx`**

1. Añadir botón `📥 Importar Excel/CSV` en la barra de herramientas de Inventario.
2. Manejar la apertura del modal y la recarga del catálogo al finalizar.

---

### Task 5: Frontend Component - Asistente de Emparejamiento Rápido (`BarcodeMatchModal.jsx`)

**Files:**
- Create: `tienda-pos/frontend/src/components/BarcodeMatchModal.jsx`
- Modify: `tienda-pos/frontend/src/App.jsx`

**Interfaces:**
- Props: `isOpen`, `scannedBarcode`, `products`, `onLinkProduct(productId, barcode)`, `onCreateNew(barcode)`, `onClose`

- [ ] **Step 1: Crear `BarcodeMatchModal.jsx`**

1. Modal de acción rápida optimizada para pantalla táctil y teclado.
2. Encabezado destacado: `🔍 Código no registrado: ${scannedBarcode}`.
3. Dos pestañas o botones claros:
   - **Opción A (Recomendada):** `🔗 Vincular a Producto Existente (Sin código / Excel)`
     - Input de búsqueda con autoenfoque: "Escribe el nombre del producto (ej: Arroz, Noel, Aceite)..."
     - Lista filtrada de productos que tienen código interno `INT-...` o código vacío.
     - Botón grande `Vincular a este producto`.
   - **Opción B:** `➕ Crear Producto Nuevo desde Cero`.
4. Atajos de teclado: <kbd>Esc</kbd> para cancelar, <kbd>Enter</kbd> para vincular el primer resultado sugerido.

- [ ] **Step 2: Integrar en `App.jsx` dentro de `handleIncomingScan`**

Cuando `found === false`:
- En la pestaña `pos` o `inventory`: abrir `BarcodeMatchModal` con el código escaneado.
- Al vincular exitosamente:
  - Si estaba en `pos`: emitir `playSoundChime(true)`, vincular el código y sumarlo inmediatamente al carrito de compras.
  - Si estaba en `inventory`: refrescar el catálogo y mostrar toast de éxito `✅ Código vinculado a: [Producto]`.

---

### Task 6: Verificación Integral del Pipeline y Build

**Files:**
- Execute: `tienda-pos` test suite y compilación en Windows y Android.

- [ ] **Step 1: Ejecutar pruebas unitarias de Go con cobertura**
Run: `go test -timeout 45s -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | tail -n 1`
Expected: Cobertura $\ge 90.0\%$.

- [ ] **Step 2: Compilar frontend de producción**
Run: `cd frontend && npm run build`
Expected: Exit 0 sin errores.

- [ ] **Step 3: Compilar binario Windows y APK Android**
Run: `wails build -platform windows/amd64 -clean` y `./gradlew assembleDebug`
Expected: Binarios generados en `build/bin/`.
