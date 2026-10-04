package main

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Product struct {
	ID            int64   `json:"id"`
	Barcode       string  `json:"barcode"`
	Name          string  `json:"name"`
	CostPrice     float64 `json:"costPrice"`
	Price         float64 `json:"price"`
	Stock         int     `json:"stock"`
	Weight        float64 `json:"weight"`
	Size          string  `json:"size"`
	UnitOfMeasure string  `json:"unitOfMeasure"`
	Color         string  `json:"color"`
	Location      string  `json:"location"`
	Active        bool    `json:"active"`
	IsQuickAccess bool    `json:"isQuickAccess"`
	Category      string  `json:"category"`
}

type Location struct {
	ID          int64  `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type ShelfLevel struct {
	Level int    `json:"level"` // 1, 2, 3... (1 is bottom)
	Name  string `json:"name"`  // e.g. "Nivel 1"
	Slots int    `json:"slots"` // number of casillas (e.g. 3)
}

type Shelf struct {
	ID          int64        `json:"id"`
	Code        string       `json:"code"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Levels      []ShelfLevel `json:"levels"`
	LevelsJSON  string       `json:"levelsJson,omitempty"`
	CreatedAt   string       `json:"createdAt,omitempty"`
}

type ShelfOccupancyItem struct {
	LocationCode string `json:"locationCode"`
	ProductCount int    `json:"productCount"`
	TotalStock   int    `json:"totalStock"`
}

type InventorySession struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	Responsible  string  `json:"responsible"`
	Scope        string  `json:"scope"`
	Notes        string  `json:"notes"`
	Status       string  `json:"status"` // 'in_progress', 'completed', 'cancelled'
	StartedAt    string  `json:"startedAt"`
	ClosedAt     *string `json:"closedAt,omitempty"`
	TotalItems   int     `json:"totalItems,omitempty"`
	CountedItems int     `json:"countedItems,omitempty"`
}

type InventorySessionItem struct {
	ID                 int64   `json:"id"`
	SessionID          int64   `json:"sessionId"`
	ProductID          int64   `json:"productId"`
	Barcode            string  `json:"barcode"`
	ProductName        string  `json:"productName"`
	Location           string  `json:"location"`
	UnitPrice          float64 `json:"unitPrice"`
	SystemStockAtStart int     `json:"systemStockAtStart"`
	CountedQty         int     `json:"countedQty"`
	IsCounted          bool    `json:"isCounted"`
	LastCountedAt      *string `json:"lastCountedAt,omitempty"`
	AdjustmentApplied  bool    `json:"adjustmentApplied"`
	StockAfter         *int    `json:"stockAfter,omitempty"`
	Notes              string  `json:"notes"`

	// Derived metrics for UI
	Variance   int     `json:"variance"`
	Difference float64 `json:"difference"`
	Breakdown  string  `json:"breakdown,omitempty"`
}

type InventoryCountEntry struct {
	ID            int64  `json:"id"`
	SessionItemID int64  `json:"sessionItemId"`
	LocationCode  string `json:"locationCode"`
	Qty           int    `json:"qty"`
	CountedAt     string `json:"countedAt"`
}

type Supplier struct {
	ID           int64  `json:"id"`
	NitOrCedula  string `json:"nitOrCedula"`
	Name         string `json:"name"`
	ContactName  string `json:"contactName"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	Address      string `json:"address"`
	City         string `json:"city"`
	PaymentTerms string `json:"paymentTerms"`
	DeliveryDays string `json:"deliveryDays"`
	Notes        string `json:"notes"`
	Active       bool   `json:"active"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

type ImportCatalogResult struct {
	TotalProcessed int      `json:"totalProcessed"`
	Inserted       int      `json:"inserted"`
	Updated        int      `json:"updated"`
	Errors         []string `json:"errors"`
}

type Purchase struct {
	ID             int64          `json:"id"`
	SupplierID     int64          `json:"supplierId"`
	SupplierName   string         `json:"supplierName"`
	InvoiceNumber  string         `json:"invoiceNumber"`
	InvoiceDate    string         `json:"invoiceDate"`
	PaymentStatus  string         `json:"paymentStatus"`
	TotalCost      float64        `json:"totalCost"`
	AttachmentPath string         `json:"attachmentPath"`
	Status         string         `json:"status"`
	Notes          string         `json:"notes"`
	CreatedAt      string         `json:"createdAt"`
	CompletedAt    *string        `json:"completedAt"`
	Items          []PurchaseItem `json:"items"`
}

type PurchaseItem struct {
	ID             int64   `json:"id"`
	PurchaseID     int64   `json:"purchaseId"`
	ProductID      int64   `json:"productId"`
	Barcode        string  `json:"barcode"`
	ProductName    string  `json:"productName"`
	Qty            int     `json:"qty"`
	UnitCost       float64 `json:"unitCost"`
	Subtotal       float64 `json:"subtotal"`
	SuggestedPrice float64 `json:"suggestedPrice"`
	CreatedAt      string  `json:"createdAt"`
}

type PurchaseInput struct {
	SupplierID     int64               `json:"supplierId"`
	InvoiceNumber  string              `json:"invoiceNumber"`
	InvoiceDate    string              `json:"invoiceDate"`
	PaymentStatus  string              `json:"paymentStatus"`
	TotalCost      float64             `json:"totalCost"`
	AttachmentPath string              `json:"attachmentPath"`
	Notes          string              `json:"notes"`
	Items          []PurchaseItemInput `json:"items"`
}

type PurchaseItemInput struct {
	ProductID      int64   `json:"productId"`
	Barcode        string  `json:"barcode"`
	ProductName    string  `json:"productName"`
	Qty            int     `json:"qty"`
	UnitCost       float64 `json:"unitCost"`
	SuggestedPrice float64 `json:"suggestedPrice"`
}

type ReportSummary struct {
	Period             string  `json:"period"`
	TotalSales         float64 `json:"totalSales"`
	TotalPurchases     float64 `json:"totalPurchases"`
	GrossMargin        float64 `json:"grossMargin"`
	GrossMarginPct     float64 `json:"grossMarginPct"`
	SalesCount         int     `json:"salesCount"`
	PurchasesCount     int     `json:"purchasesCount"`
	AverageTicket      float64 `json:"averageTicket"`
	DianUvtThreshold   float64 `json:"dianUvtThreshold"`
	DianCurrentPct     float64 `json:"dianCurrentPct"`
}


func initDB(filepath string) *sql.DB {
	dsn := filepath
	if !strings.Contains(filepath, "?") {
		dsn = fmt.Sprintf("%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)", filepath)
	}

	db, err := sql.Open("sqlite", dsn)
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

	baseSchema := `
	CREATE TABLE IF NOT EXISTS products (
		id              INTEGER PRIMARY KEY AUTOINCREMENT,
		barcode         TEXT UNIQUE NOT NULL,
		name            TEXT NOT NULL,
		cost_price      REAL NOT NULL DEFAULT 0.0,
		price           REAL NOT NULL DEFAULT 0.0,
		stock           INTEGER NOT NULL DEFAULT 0,
		weight          REAL NOT NULL DEFAULT 0.0,
		size            TEXT NOT NULL DEFAULT '',
		unit_of_measure TEXT NOT NULL DEFAULT 'und',
		color           TEXT NOT NULL DEFAULT '',
		location        TEXT NOT NULL DEFAULT '',
		active          INTEGER NOT NULL DEFAULT 1,
		category        TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

	CREATE TABLE IF NOT EXISTS locations (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		code        TEXT UNIQUE NOT NULL,
		name        TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);

	CREATE TABLE IF NOT EXISTS shelves (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		code        TEXT UNIQUE NOT NULL,
		name        TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		levels_json TEXT NOT NULL DEFAULT '[]',
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_shelves_code ON shelves(code);

	CREATE TABLE IF NOT EXISTS inventory_sessions (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		name          TEXT NOT NULL,
		responsible   TEXT NOT NULL DEFAULT '',
		scope         TEXT NOT NULL DEFAULT 'ALL',
		notes         TEXT NOT NULL DEFAULT '',
		status        TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
		started_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
		closed_at     DATETIME
	);

	CREATE TABLE IF NOT EXISTS inventory_session_items (
		id                    INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id            INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
		product_id            INTEGER NOT NULL REFERENCES products(id),
		barcode               TEXT NOT NULL,
		product_name          TEXT NOT NULL,
		location              TEXT NOT NULL DEFAULT '',
		unit_price            REAL NOT NULL DEFAULT 0.0,
		system_stock_at_start INTEGER NOT NULL DEFAULT 0,
		counted_qty           INTEGER NOT NULL DEFAULT 0,
		is_counted            INTEGER NOT NULL DEFAULT 0,
		last_counted_at       DATETIME,
		adjustment_applied    INTEGER NOT NULL DEFAULT 0,
		stock_after           INTEGER,
		notes                 TEXT NOT NULL DEFAULT '',
		UNIQUE(session_id, product_id)
	);

	CREATE TABLE IF NOT EXISTS inventory_count_entries (
		id              INTEGER PRIMARY KEY AUTOINCREMENT,
		session_item_id INTEGER NOT NULL REFERENCES inventory_session_items(id) ON DELETE CASCADE,
		location_code   TEXT NOT NULL DEFAULT '',
		qty             INTEGER NOT NULL CHECK (qty >= 0),
		counted_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(session_item_id, location_code)
	);
	`
	if _, err := db.Exec(baseSchema); err != nil {
		log.Fatalf("Error creando esquema base: %v", err)
	}

	migrateProductsTable(db)
	migratePOSTables(db)

	indexes := `
	CREATE INDEX IF NOT EXISTS idx_products_location ON products(location);
	CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
	CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session ON inventory_sessions(status) WHERE status = 'in_progress';
	CREATE INDEX IF NOT EXISTS idx_inv_items_session ON inventory_session_items(session_id);
	CREATE INDEX IF NOT EXISTS idx_inv_items_counted ON inventory_session_items(session_id, is_counted);
	CREATE INDEX IF NOT EXISTS idx_inv_items_barcode ON inventory_session_items(session_id, barcode);
	CREATE INDEX IF NOT EXISTS idx_count_entries_item ON inventory_count_entries(session_item_id);
	CREATE UNIQUE INDEX IF NOT EXISTS idx_count_entries_unique ON inventory_count_entries(session_item_id, location_code);
	`
	if _, err := db.Exec(indexes); err != nil {
		log.Fatalf("Error creando índices migrados: %v", err)
	}

	return db
}

func migrateProductsTable(db *sql.DB) {
	rows, err := db.Query("PRAGMA table_info(products)")
	if err != nil {
		log.Printf("Warning: error reading table_info: %v", err)
		return
	}
	defer rows.Close()

	existingCols := make(map[string]bool)
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltVal sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltVal, &pk); err == nil {
			existingCols[strings.ToLower(name)] = true
		}
	}

	columnsToAdd := map[string]string{
		"cost_price":      "REAL NOT NULL DEFAULT 0.0",
		"weight":          "REAL NOT NULL DEFAULT 0.0",
		"size":            "TEXT NOT NULL DEFAULT ''",
		"unit_of_measure": "TEXT NOT NULL DEFAULT 'und'",
		"color":           "TEXT NOT NULL DEFAULT ''",
		"location":        "TEXT NOT NULL DEFAULT ''",
		"active":          "INTEGER NOT NULL DEFAULT 1",
		"category":        "TEXT NOT NULL DEFAULT ''",
	}

	for col, colDef := range columnsToAdd {
		if !existingCols[col] {
			alterStmt := fmt.Sprintf("ALTER TABLE products ADD COLUMN %s %s;", col, colDef)
			if _, err := db.Exec(alterStmt); err != nil {
				log.Printf("Warning: error adding column %s: %v", col, err)
			}
		}
	}
}

func generateInternalSKU(db *sql.DB) (string, error) {
	var maxID sql.NullInt64
	_ = db.QueryRow("SELECT MAX(id) FROM products").Scan(&maxID)
	nextID := int64(1)
	if maxID.Valid {
		nextID = maxID.Int64 + 1
	}

	for {
		sku := fmt.Sprintf("INT-%06d", nextID)
		var exists int
		err := db.QueryRow("SELECT 1 FROM products WHERE barcode = ?", sku).Scan(&exists)
		if err == sql.ErrNoRows {
			return sku, nil
		}
		if err != nil {
			return "", err
		}
		nextID++
	}
}

func getProductByBarcode(db *sql.DB, barcode string) (*Product, error) {
	query := `
	SELECT id, barcode, name, cost_price, price, stock, weight, size, unit_of_measure, color, location, active, is_quick_access, category
	FROM products
	WHERE barcode = ?
	LIMIT 1`
	row := db.QueryRow(query, strings.TrimSpace(barcode))

	var p Product
	var activeInt int
	var quickAccessInt sql.NullInt64
	var categoryStr sql.NullString
	err := row.Scan(
		&p.ID,
		&p.Barcode,
		&p.Name,
		&p.CostPrice,
		&p.Price,
		&p.Stock,
		&p.Weight,
		&p.Size,
		&p.UnitOfMeasure,
		&p.Color,
		&p.Location,
		&activeInt,
		&quickAccessInt,
		&categoryStr,
	)
	if err != nil {
		return nil, err
	}
	p.Active = (activeInt == 1)
	p.IsQuickAccess = (quickAccessInt.Valid && quickAccessInt.Int64 == 1)
	p.Category = categoryStr.String
	return &p, nil
}

func saveOrUpdateProduct(db *sql.DB, p Product) error {
	p.Name = strings.TrimSpace(p.Name)
	if p.Name == "" {
		return fmt.Errorf("el nombre del producto es requerido")
	}

	p.Barcode = strings.TrimSpace(p.Barcode)
	if p.Barcode == "" {
		sku, err := generateInternalSKU(db)
		if err != nil {
			return err
		}
		p.Barcode = sku
	}
	if p.UnitOfMeasure == "" {
		p.UnitOfMeasure = "und"
	}

	activeInt := 0
	if p.Active {
		activeInt = 1
	}
	quickAccessInt := 0
	if p.IsQuickAccess {
		quickAccessInt = 1
	}

	if p.ID > 0 {
		// Rule 6 Backend Enforcement: If an audit session is in progress, do not alter live stock
		var activeAuditCount int
		_ = db.QueryRow("SELECT COUNT(1) FROM inventory_sessions WHERE status = 'in_progress'").Scan(&activeAuditCount)
		stockToSet := p.Stock
		if activeAuditCount > 0 {
			// Preserve existing stock from database
			_ = db.QueryRow("SELECT stock FROM products WHERE id = ?", p.ID).Scan(&stockToSet)
		}

		query := `
		UPDATE products SET
			barcode = ?,
			name = ?,
			cost_price = ?,
			price = ?,
			stock = ?,
			weight = ?,
			size = ?,
			unit_of_measure = ?,
			color = ?,
			location = ?,
			active = ?,
			is_quick_access = ?,
			category = ?
		WHERE id = ?;
		`
		_, err := db.Exec(
			query,
			p.Barcode,
			p.Name,
			p.CostPrice,
			p.Price,
			stockToSet,
			p.Weight,
			p.Size,
			p.UnitOfMeasure,
			p.Color,
			p.Location,
			activeInt,
			quickAccessInt,
			p.Category,
			p.ID,
		)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				return fmt.Errorf("el código de barras '%s' ya está registrado en otro producto", p.Barcode)
			}
			return err
		}
		return nil
	}

	var activeAuditCount int
	_ = db.QueryRow("SELECT COUNT(1) FROM inventory_sessions WHERE status = 'in_progress'").Scan(&activeAuditCount)
	stockUpdateClause := "stock = excluded.stock,"
	if activeAuditCount > 0 {
		stockUpdateClause = "stock = products.stock," // Preserve existing stock during active audit
	}

	query := fmt.Sprintf(`
	INSERT INTO products (barcode, name, cost_price, price, stock, weight, size, unit_of_measure, color, location, active, is_quick_access, category)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(barcode) DO UPDATE SET
		name = excluded.name,
		cost_price = excluded.cost_price,
		price = excluded.price,
		%s
		weight = excluded.weight,
		size = excluded.size,
		unit_of_measure = excluded.unit_of_measure,
		color = excluded.color,
		location = excluded.location,
		active = excluded.active,
		is_quick_access = excluded.is_quick_access,
		category = excluded.category;
	`, stockUpdateClause)
	_, err := db.Exec(
		query,
		p.Barcode,
		p.Name,
		p.CostPrice,
		p.Price,
		p.Stock,
		p.Weight,
		p.Size,
		p.UnitOfMeasure,
		p.Color,
		p.Location,
		activeInt,
		quickAccessInt,
		p.Category,
	)
	return err
}

func updateProductLocation(db *sql.DB, barcode string, location string) error {
	query := `UPDATE products SET location = ? WHERE barcode = ?;`
	res, err := db.Exec(query, strings.TrimSpace(location), strings.TrimSpace(barcode))
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func archiveProduct(db *sql.DB, barcode string) error {
	code := strings.TrimSpace(barcode)
	var exists int
	err := db.QueryRow(`SELECT 1 FROM products WHERE barcode = ? LIMIT 1;`, code).Scan(&exists)
	if err != nil {
		return err
	}
	_, err = db.Exec(`UPDATE products SET active = 0 WHERE barcode = ?;`, code)
	return err
}

func restoreProduct(db *sql.DB, barcode string) error {
	code := strings.TrimSpace(barcode)
	var exists int
	err := db.QueryRow(`SELECT 1 FROM products WHERE barcode = ? LIMIT 1;`, code).Scan(&exists)
	if err != nil {
		return err
	}
	_, err = db.Exec(`UPDATE products SET active = 1 WHERE barcode = ?;`, code)
	return err
}

func listAllProducts(db *sql.DB) ([]Product, error) {
	rows, err := db.Query(`
		SELECT id, barcode, name, cost_price, price, stock, weight, size, unit_of_measure, color, location, active, is_quick_access, category
		FROM products
		WHERE active = 1
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanProductRows(rows)
}

func listInventoryProducts(db *sql.DB, includeArchived bool) ([]Product, error) {
	query := `
		SELECT id, barcode, name, cost_price, price, stock, weight, size, unit_of_measure, color, location, active, is_quick_access, category
		FROM products
	`
	if !includeArchived {
		query += " WHERE active = 1"
	}
	query += " ORDER BY id DESC"

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanProductRows(rows)
}

func searchProducts(db *sql.DB, search string) ([]Product, error) {
	term := "%" + strings.TrimSpace(search) + "%"
	rows, err := db.Query(`
		SELECT id, barcode, name, cost_price, price, stock, weight, size, unit_of_measure, color, location, active, is_quick_access, category
		FROM products
		WHERE active = 1 AND (barcode LIKE ? OR name LIKE ? OR location LIKE ? OR category LIKE ?)
		ORDER BY name ASC
		LIMIT 20
	`, term, term, term, term)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanProductRows(rows)
}

func scanProductRows(rows *sql.Rows) ([]Product, error) {
	list := make([]Product, 0)
	for rows.Next() {
		var p Product
		var activeInt int
		var quickAccessInt sql.NullInt64
		var categoryStr sql.NullString
		err := rows.Scan(
			&p.ID,
			&p.Barcode,
			&p.Name,
			&p.CostPrice,
			&p.Price,
			&p.Stock,
			&p.Weight,
			&p.Size,
			&p.UnitOfMeasure,
			&p.Color,
			&p.Location,
			&activeInt,
			&quickAccessInt,
			&categoryStr,
		)
		if err != nil {
			return nil, err
		}
		p.Active = (activeInt == 1)
		p.IsQuickAccess = (quickAccessInt.Valid && quickAccessInt.Int64 == 1)
		p.Category = categoryStr.String
		list = append(list, p)
	}
	return list, nil
}

func saveLocation(db *sql.DB, loc Location) error {
	loc.Code = strings.TrimSpace(strings.ToUpper(loc.Code))
	loc.Name = strings.TrimSpace(loc.Name)
	if loc.Code == "" {
		return fmt.Errorf("el código de la locación no puede estar vacío")
	}
	if loc.Name == "" {
		return fmt.Errorf("el nombre de la locación no puede estar vacío")
	}

	if loc.ID > 0 {
		query := `UPDATE locations SET code = ?, name = ?, description = ? WHERE id = ?;`
		_, err := db.Exec(query, loc.Code, loc.Name, loc.Description, loc.ID)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				return fmt.Errorf("el código de locación '%s' ya está registrado", loc.Code)
			}
			return err
		}
		return nil
	}

	query := `
	INSERT INTO locations (code, name, description)
	VALUES (?, ?, ?)
	ON CONFLICT(code) DO UPDATE SET
		name = excluded.name,
		description = excluded.description;
	`
	_, err := db.Exec(query, loc.Code, loc.Name, loc.Description)
	return err
}

func getAllLocations(db *sql.DB) ([]Location, error) {
	rows, err := db.Query(`SELECT id, code, name, description FROM locations ORDER BY code ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Location, 0)
	for rows.Next() {
		var l Location
		if err := rows.Scan(&l.ID, &l.Code, &l.Name, &l.Description); err != nil {
			return nil, err
		}
		list = append(list, l)
	}
	return list, nil
}

func deleteLocation(db *sql.DB, id int64) error {
	_, err := db.Exec(`DELETE FROM locations WHERE id = ?`, id)
	return err
}

// --- Shelves & Structured Positions Management ---

func saveShelf(db *sql.DB, shelf Shelf) error {
	shelf.Code = strings.TrimSpace(strings.ToUpper(shelf.Code))
	shelf.Name = strings.TrimSpace(shelf.Name)
	if shelf.Code == "" {
		return fmt.Errorf("el código del estante no puede estar vacío")
	}
	if shelf.Name == "" {
		return fmt.Errorf("el nombre del estante no puede estar vacío")
	}
	if len(shelf.Levels) == 0 {
		return fmt.Errorf("el estante debe tener al menos un nivel")
	}

	// Validate levels and slots
	for i := range shelf.Levels {
		if shelf.Levels[i].Level <= 0 {
			shelf.Levels[i].Level = i + 1
		}
		if shelf.Levels[i].Slots <= 0 {
			shelf.Levels[i].Slots = 1
		}
		if shelf.Levels[i].Name == "" {
			shelf.Levels[i].Name = fmt.Sprintf("Nivel %d", shelf.Levels[i].Level)
		}
	}

	levelsBytes, err := json.Marshal(shelf.Levels)
	if err != nil {
		return fmt.Errorf("error serializando niveles del estante: %w", err)
	}
	levelsJSON := string(levelsBytes)

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if shelf.ID > 0 {
		query := `UPDATE shelves SET code = ?, name = ?, description = ?, levels_json = ? WHERE id = ?;`
		_, err = tx.Exec(query, shelf.Code, shelf.Name, shelf.Description, levelsJSON, shelf.ID)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				return fmt.Errorf("el código de estante '%s' ya está registrado", shelf.Code)
			}
			return err
		}
	} else {
		query := `
		INSERT INTO shelves (code, name, description, levels_json)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(code) DO UPDATE SET
			name = excluded.name,
			description = excluded.description,
			levels_json = excluded.levels_json;
		`
		_, err = tx.Exec(query, shelf.Code, shelf.Name, shelf.Description, levelsJSON)
		if err != nil {
			return err
		}
	}

	// Auto-generate / upsert child locations in locations table for each slot
	// Example: EST1-N1-C1, EST1-N1-C2, EST1-N2-C1...
	locQuery := `
	INSERT INTO locations (code, name, description)
	VALUES (?, ?, ?)
	ON CONFLICT(code) DO UPDATE SET
		name = excluded.name,
		description = excluded.description;
	`
	for _, lvl := range shelf.Levels {
		for slot := 1; slot <= lvl.Slots; slot++ {
			locCode := fmt.Sprintf("%s-N%d-C%d", shelf.Code, lvl.Level, slot)
			locName := fmt.Sprintf("%s - %s, Casilla %d", shelf.Name, lvl.Name, slot)
			locDesc := fmt.Sprintf("Estante: %s (%s)", shelf.Name, shelf.Code)
			if _, err := tx.Exec(locQuery, locCode, locName, locDesc); err != nil {
				return fmt.Errorf("error generando posición %s: %w", locCode, err)
			}
		}
	}

	return tx.Commit()
}

func getAllShelves(db *sql.DB) ([]Shelf, error) {
	rows, err := db.Query(`SELECT id, code, name, description, levels_json, datetime(created_at, 'localtime') FROM shelves ORDER BY code ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Shelf, 0)
	for rows.Next() {
		var s Shelf
		var levelsJSON string
		var createdAt sql.NullString
		if err := rows.Scan(&s.ID, &s.Code, &s.Name, &s.Description, &levelsJSON, &createdAt); err != nil {
			return nil, err
		}
		s.LevelsJSON = levelsJSON
		if createdAt.Valid {
			s.CreatedAt = createdAt.String
		}
		if levelsJSON != "" && levelsJSON != "[]" {
			var levels []ShelfLevel
			if err := json.Unmarshal([]byte(levelsJSON), &levels); err == nil {
				s.Levels = levels
			}
		}
		if s.Levels == nil {
			s.Levels = make([]ShelfLevel, 0)
		}
		list = append(list, s)
	}
	return list, nil
}

func deleteShelf(db *sql.DB, id int64) error {
	var shelfCode string
	err := db.QueryRow("SELECT code FROM shelves WHERE id = ?", id).Scan(&shelfCode)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`DELETE FROM shelves WHERE id = ?`, id)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`DELETE FROM locations WHERE code LIKE ? || '-%'`, shelfCode)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func getShelfOccupancy(db *sql.DB, shelfCode string) (map[string]ShelfOccupancyItem, error) {
	shelfCode = strings.TrimSpace(strings.ToUpper(shelfCode))
	query := `
		SELECT location, COUNT(*), COALESCE(SUM(stock), 0)
		FROM products
		WHERE (location = ? OR location LIKE ? OR location LIKE ?) AND active = 1
		GROUP BY location
	`
	rows, err := db.Query(query, shelfCode, shelfCode+"-%", shelfCode+" %")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]ShelfOccupancyItem)
	for rows.Next() {
		var loc string
		var count int
		var stock int
		if err := rows.Scan(&loc, &count, &stock); err != nil {
			return nil, err
		}
		baseCode := strings.TrimSpace(strings.Split(loc, " - ")[0])
		existing := result[baseCode]
		result[baseCode] = ShelfOccupancyItem{
			LocationCode: baseCode,
			ProductCount: existing.ProductCount + count,
			TotalStock:   existing.TotalStock + stock,
		}
	}
	return result, nil
}

// --- Physical Inventory Sessions (Stock Audits) ---

func startInventorySession(db *sql.DB, name, responsible, scope, notes string) (*InventorySession, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("el nombre del inventario no puede estar vacío")
	}

	scope = strings.TrimSpace(strings.ToUpper(scope))
	if scope == "" {
		scope = "ALL"
	}

	var activeCount int
	_ = db.QueryRow("SELECT COUNT(1) FROM inventory_sessions WHERE status = 'in_progress'").Scan(&activeCount)
	if activeCount > 0 {
		return nil, fmt.Errorf("ya existe una toma de inventario activa en progreso. Debes finalizarla o cancelarla antes de iniciar una nueva")
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO inventory_sessions (name, responsible, scope, notes, status, started_at)
		VALUES (?, ?, ?, ?, 'in_progress', CURRENT_TIMESTAMP);
	`, name, strings.TrimSpace(responsible), scope, strings.TrimSpace(notes))
	if err != nil {
		return nil, fmt.Errorf("error creando cabecera de inventario: %w", err)
	}

	sessionID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	// Pre-populate snapshot
	if scope == "ALL" {
		_, err = tx.Exec(`
			INSERT INTO inventory_session_items (
				session_id, product_id, barcode, product_name, location, unit_price, system_stock_at_start, counted_qty, is_counted
			)
			SELECT ?, id, barcode, name, location, price, stock, 0, 0
			FROM products
			WHERE active = 1
			ORDER BY name ASC;
		`, sessionID)
	} else {
		shelvesList := strings.Split(scope, ",")
		var clauses []string
		var args []interface{}
		args = append(args, sessionID)

		for _, rawSh := range shelvesList {
			sh := strings.TrimSpace(rawSh)
			if sh == "" {
				continue
			}
			baseSh := strings.TrimSpace(strings.Split(sh, " - ")[0])
			clauses = append(clauses, `(
				location = ? OR location = ? OR 
				location LIKE ? || '-%' OR location LIKE ? || '-%' OR 
				location LIKE ? || ' - %' OR location LIKE ? || ' - %' OR 
				location LIKE ? || ' %' OR location LIKE ? || ' %'
			)`)
			args = append(args, sh, baseSh, sh, baseSh, sh, baseSh, sh, baseSh)
		}

		whereClause := "1=0"
		if len(clauses) > 0 {
			whereClause = strings.Join(clauses, " OR ")
		}

		query := fmt.Sprintf(`
			INSERT INTO inventory_session_items (
				session_id, product_id, barcode, product_name, location, unit_price, system_stock_at_start, counted_qty, is_counted
			)
			SELECT ?, id, barcode, name, location, price, stock, 0, 0
			FROM products
			WHERE active = 1 AND (%s)
			ORDER BY name ASC;
		`, whereClause)

		_, err = tx.Exec(query, args...)
	}
	if err != nil {
		return nil, fmt.Errorf("error capturando snapshot de productos: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return getActiveInventorySession(db)
}

func getActiveInventorySession(db *sql.DB) (*InventorySession, error) {
	query := `
		SELECT id, name, responsible, scope, notes, status, started_at, closed_at
		FROM inventory_sessions
		WHERE status = 'in_progress'
		LIMIT 1;
	`
	row := db.QueryRow(query)

	var sess InventorySession
	var closedAt sql.NullString
	err := row.Scan(
		&sess.ID,
		&sess.Name,
		&sess.Responsible,
		&sess.Scope,
		&sess.Notes,
		&sess.Status,
		&sess.StartedAt,
		&closedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if closedAt.Valid {
		sess.ClosedAt = &closedAt.String
	}

	_ = db.QueryRow(`
		SELECT COUNT(1), COALESCE(SUM(is_counted), 0)
		FROM inventory_session_items
		WHERE session_id = ?;
	`, sess.ID).Scan(&sess.TotalItems, &sess.CountedItems)

	return &sess, nil
}

func listInventorySessionItems(db *sql.DB, sessionId int64) ([]InventorySessionItem, error) {
	query := `
		SELECT 
			id, session_id, product_id, barcode, product_name, location, unit_price, 
			system_stock_at_start, counted_qty, is_counted, last_counted_at, 
			adjustment_applied, stock_after, notes
		FROM inventory_session_items
		WHERE session_id = ?
		ORDER BY is_counted ASC, product_name ASC;
	`
	rows, err := db.Query(query, sessionId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]InventorySessionItem, 0)
	for rows.Next() {
		var item InventorySessionItem
		var isCountedInt, adjAppliedInt int
		var lastCounted, stockAfter sql.NullString

		err := rows.Scan(
			&item.ID,
			&item.SessionID,
			&item.ProductID,
			&item.Barcode,
			&item.ProductName,
			&item.Location,
			&item.UnitPrice,
			&item.SystemStockAtStart,
			&item.CountedQty,
			&isCountedInt,
			&lastCounted,
			&adjAppliedInt,
			&stockAfter,
			&item.Notes,
		)
		if err != nil {
			return nil, err
		}

		item.IsCounted = (isCountedInt == 1)
		item.AdjustmentApplied = (adjAppliedInt == 1)
		if lastCounted.Valid {
			item.LastCountedAt = &lastCounted.String
		}
		if stockAfter.Valid {
			val, _ := strconv.Atoi(stockAfter.String)
			item.StockAfter = &val
		}

		item.Variance = item.CountedQty - item.SystemStockAtStart
		item.Difference = float64(item.Variance) * item.UnitPrice

		list = append(list, item)
	}

	// Bulk fetch location breakdowns (eliminates N+1 query)
	breakdownMap := make(map[int64][]string)
	entryRows, err := db.Query(`
		SELECT e.session_item_id, e.location_code, SUM(e.qty)
		FROM inventory_count_entries e
		JOIN inventory_session_items i ON i.id = e.session_item_id
		WHERE i.session_id = ?
		GROUP BY e.session_item_id, e.location_code
		ORDER BY e.location_code ASC;
	`, sessionId)
	if err == nil {
		defer entryRows.Close()
		for entryRows.Next() {
			var sItemID int64
			var loc string
			var sumQty int
			if err := entryRows.Scan(&sItemID, &loc, &sumQty); err == nil {
				if loc == "" {
					loc = "General"
				}
				breakdownMap[sItemID] = append(breakdownMap[sItemID], fmt.Sprintf("%s: %d", loc, sumQty))
			}
		}
	}

	for i := range list {
		if parts, ok := breakdownMap[list[i].ID]; ok {
			list[i].Breakdown = strings.Join(parts, ", ")
		}
	}

	return list, nil
}

func recordInventoryCountEntry(db *sql.DB, sessionItemId int64, locationCode string, qty int, replace bool) error {
	if qty < 0 {
		return fmt.Errorf("la cantidad contada no puede ser negativa")
	}

	// Validate session is active and in_progress
	var sessionStatus string
	err := db.QueryRow(`
		SELECT s.status 
		FROM inventory_sessions s
		JOIN inventory_session_items i ON i.session_id = s.id
		WHERE i.id = ?
		LIMIT 1;
	`, sessionItemId).Scan(&sessionStatus)
	if err != nil {
		return fmt.Errorf("ítem de inventario no encontrado: %w", err)
	}
	if sessionStatus != "in_progress" {
		return fmt.Errorf("la toma de inventario no está activa (estado actual: %s)", sessionStatus)
	}

	loc := strings.TrimSpace(strings.ToUpper(locationCode))
	if loc == "" {
		// Fallback to item location
		var itemLoc string
		_ = db.QueryRow("SELECT location FROM inventory_session_items WHERE id = ?", sessionItemId).Scan(&itemLoc)
		loc = strings.TrimSpace(strings.ToUpper(itemLoc))
		if loc == "" {
			loc = "GENERAL"
		}
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Atomic upsert with ON CONFLICT (prevents lost counts on concurrent rapid scans)
	if replace {
		_, err = tx.Exec(`
			INSERT INTO inventory_count_entries (session_item_id, location_code, qty, counted_at)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(session_item_id, location_code)
			DO UPDATE SET qty = excluded.qty, counted_at = CURRENT_TIMESTAMP;
		`, sessionItemId, loc, qty)
	} else {
		_, err = tx.Exec(`
			INSERT INTO inventory_count_entries (session_item_id, location_code, qty, counted_at)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(session_item_id, location_code)
			DO UPDATE SET qty = inventory_count_entries.qty + excluded.qty, counted_at = CURRENT_TIMESTAMP;
		`, sessionItemId, loc, qty)
	}
	if err != nil {
		return fmt.Errorf("error registrando conteo físico: %w", err)
	}

	// Recalculate derived counted_qty (Rule 1)
	_, err = tx.Exec(`
		UPDATE inventory_session_items
		SET counted_qty = (SELECT COALESCE(SUM(qty), 0) FROM inventory_count_entries WHERE session_item_id = ?),
		    is_counted = 1,
		    last_counted_at = CURRENT_TIMESTAMP
		WHERE id = ?;
	`, sessionItemId, sessionItemId)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func undoLastInventoryEntry(db *sql.DB, sessionItemId int64) error {
	// Validate session is active
	var sessionStatus string
	err := db.QueryRow(`
		SELECT s.status 
		FROM inventory_sessions s
		JOIN inventory_session_items i ON i.session_id = s.id
		WHERE i.id = ?
		LIMIT 1;
	`, sessionItemId).Scan(&sessionStatus)
	if err != nil {
		return fmt.Errorf("ítem de inventario no encontrado: %w", err)
	}
	if sessionStatus != "in_progress" {
		return fmt.Errorf("la toma de inventario no está activa (estado actual: %s)", sessionStatus)
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var entryID int64
	var curQty int
	err = tx.QueryRow(`
		SELECT id, qty FROM inventory_count_entries 
		WHERE session_item_id = ? 
		ORDER BY counted_at DESC, id DESC 
		LIMIT 1;
	`, sessionItemId).Scan(&entryID, &curQty)
	if err == sql.ErrNoRows {
		return nil // Nothing to undo
	}
	if err != nil {
		return err
	}

	if curQty > 1 {
		_, err = tx.Exec("UPDATE inventory_count_entries SET qty = qty - 1, counted_at = CURRENT_TIMESTAMP WHERE id = ?", entryID)
	} else {
		_, err = tx.Exec("DELETE FROM inventory_count_entries WHERE id = ?", entryID)
	}
	if err != nil {
		return err
	}

	// Recalculate derived counted_qty
	_, err = tx.Exec(`
		UPDATE inventory_session_items
		SET counted_qty = (SELECT COALESCE(SUM(qty), 0) FROM inventory_count_entries WHERE session_item_id = ?),
		    is_counted = CASE WHEN (SELECT COUNT(1) FROM inventory_count_entries WHERE session_item_id = ?) > 0 THEN 1 ELSE 0 END,
		    last_counted_at = CURRENT_TIMESTAMP
		WHERE id = ?;
	`, sessionItemId, sessionItemId, sessionItemId)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func closeInventorySession(db *sql.DB, sessionId int64, productIdsToUpdate []int64) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var status string
	err = tx.QueryRow("SELECT status FROM inventory_sessions WHERE id = ?", sessionId).Scan(&status)
	if err != nil {
		return fmt.Errorf("inventario no encontrado: %w", err)
	}
	if status != "in_progress" {
		return fmt.Errorf("la sesión #%d no está en progreso (estado actual: %s)", sessionId, status)
	}

	toUpdateMap := make(map[int64]bool)
	for _, pid := range productIdsToUpdate {
		toUpdateMap[pid] = true
	}

	rows, err := tx.Query(`
		SELECT id, product_id, counted_qty, is_counted, last_counted_at
		FROM inventory_session_items 
		WHERE session_id = ?;
	`, sessionId)
	if err != nil {
		return err
	}
	defer rows.Close()

	type itemCloseData struct {
		id            int64
		productID     int64
		countedQty    int
		isCounted     bool
		lastCountedAt sql.NullString
	}
	var items []itemCloseData
	for rows.Next() {
		var it itemCloseData
		var isCountedInt int
		if err := rows.Scan(&it.id, &it.productID, &it.countedQty, &isCountedInt, &it.lastCountedAt); err != nil {
			return err
		}
		it.isCounted = (isCountedInt == 1)
		items = append(items, it)
	}
	rows.Close()

	for _, it := range items {
		// Safety Guardrail: Only apply stock update if explicitly checked AND is_counted == true
		if toUpdateMap[it.productID] && it.isCounted {
			finalQty := it.countedQty

			if it.lastCountedAt.Valid {
				var salesAfterCount int
				errSales := tx.QueryRow(`
					SELECT COALESCE(SUM(qty), 0)
					FROM sale_items si
					JOIN sales s ON s.id = si.sale_id
					WHERE si.product_id = ? AND datetime(s.created_at) > datetime(?)
				`, it.productID, it.lastCountedAt.String).Scan(&salesAfterCount)
				if errSales == nil && salesAfterCount > 0 {
					finalQty -= salesAfterCount
				}

				var purchasesAfterCount int
				errPurchases := tx.QueryRow(`
					SELECT COALESCE(SUM(pi.qty), 0)
					FROM purchase_items pi
					JOIN purchases p ON p.id = pi.purchase_id
					WHERE pi.product_id = ? AND datetime(p.created_at) > datetime(?)
				`, it.productID, it.lastCountedAt.String).Scan(&purchasesAfterCount)
				if errPurchases == nil && purchasesAfterCount > 0 {
					finalQty += purchasesAfterCount
				}
			}

			_, err = tx.Exec("UPDATE products SET stock = ? WHERE id = ?;", finalQty, it.productID)
			if err != nil {
				return fmt.Errorf("error actualizando stock de producto #%d: %w", it.productID, err)
			}
			_, err = tx.Exec("UPDATE inventory_session_items SET adjustment_applied = 1, stock_after = ? WHERE id = ?;", finalQty, it.id)
			if err != nil {
				return err
			}
		} else {
			_, err = tx.Exec("UPDATE inventory_session_items SET adjustment_applied = 0, stock_after = NULL WHERE id = ?;", it.id)
			if err != nil {
				return err
			}
		}
	}

	_, err = tx.Exec("UPDATE inventory_sessions SET status = 'completed', closed_at = CURRENT_TIMESTAMP WHERE id = ?;", sessionId)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func cancelInventorySession(db *sql.DB, sessionId int64) error {
	res, err := db.Exec(`
		UPDATE inventory_sessions 
		SET status = 'cancelled', closed_at = CURRENT_TIMESTAMP 
		WHERE id = ? AND status = 'in_progress';
	`, sessionId)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("no existe ninguna sesión activa con id %d para cancelar", sessionId)
	}
	return nil
}

func listCompletedSessions(db *sql.DB) ([]InventorySession, error) {
	rows, err := db.Query(`
		SELECT 
			s.id, s.name, s.responsible, s.scope, s.notes, s.status, s.started_at, s.closed_at,
			COUNT(i.id), COALESCE(SUM(i.is_counted), 0)
		FROM inventory_sessions s
		LEFT JOIN inventory_session_items i ON i.session_id = s.id
		WHERE s.status IN ('completed', 'cancelled')
		GROUP BY s.id
		ORDER BY s.id DESC;
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]InventorySession, 0)
	for rows.Next() {
		var s InventorySession
		var closedAt sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &s.Responsible, &s.Scope, &s.Notes, &s.Status, &s.StartedAt, &closedAt, &s.TotalItems, &s.CountedItems); err != nil {
			return nil, err
		}
		if closedAt.Valid {
			s.ClosedAt = &closedAt.String
		}
		list = append(list, s)
	}

	return list, nil
}

func exportSessionReportCSV(db *sql.DB, sessionId int64) (string, error) {
	var sessName, sessResp, sessScope, sessStarted, sessStatus string
	var sessClosed sql.NullString
	err := db.QueryRow(`
		SELECT name, responsible, scope, started_at, closed_at, status
		FROM inventory_sessions WHERE id = ?;
	`, sessionId).Scan(&sessName, &sessResp, &sessScope, &sessStarted, &sessClosed, &sessStatus)
	if err != nil {
		return "", fmt.Errorf("inventario no encontrado: %w", err)
	}

	items, err := listInventorySessionItems(db, sessionId)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	buf.WriteString("\xef\xbb\xbf") // UTF-8 BOM
	writer := csv.NewWriter(&buf)

	// Summary header
	_ = writer.Write([]string{"REPORTE DE TOMA DE INVENTARIO - iLuz"})
	_ = writer.Write([]string{"Nombre", sessName})
	_ = writer.Write([]string{"Responsable", sessResp})
	_ = writer.Write([]string{"Alcance", sessScope})
	_ = writer.Write([]string{"Fecha Inicio", sessStarted})
	if sessClosed.Valid {
		_ = writer.Write([]string{"Fecha Cierre", sessClosed.String})
	}
	_ = writer.Write([]string{"Estado", sessStatus})
	_ = writer.Write([]string{}) // Empty row separator

	headers := []string{
		"Código de Barras",
		"Nombre del Producto",
		"Ubicación Principal",
		"Stock Inicial Sistema",
		"Conteo Físico Real",
		"Diferencia (Varianza)",
		"Precio Unitario",
		"Impacto Financiero",
		"Estado Conteo",
		"Ajuste Aplicado en BD",
		"Stock Final en BD",
		"Desglose por Ubicaciones",
	}
	_ = writer.Write(headers)

	for _, it := range items {
		countedStatus := "No contado (pendiente)"
		if it.IsCounted {
			countedStatus = "Contado"
		}

		adjStatus := "No"
		if it.AdjustmentApplied {
			adjStatus = "Sí (Aplicado)"
		}

		finalStockStr := "-"
		if it.StockAfter != nil {
			finalStockStr = strconv.Itoa(*it.StockAfter)
		}

		row := []string{
			it.Barcode,
			it.ProductName,
			it.Location,
			strconv.Itoa(it.SystemStockAtStart),
			strconv.Itoa(it.CountedQty),
			strconv.Itoa(it.Variance),
			fmt.Sprintf("%.2f", it.UnitPrice),
			fmt.Sprintf("%.2f", it.Difference),
			countedStatus,
			adjStatus,
			finalStockStr,
			it.Breakdown,
		}
		_ = writer.Write(row)
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// POS Structs
type StoreConfig struct {
	ID                 int64  `json:"id"`
	StoreName          string `json:"storeName"`
	OwnerName          string `json:"ownerName"`
	NitOrCedula        string `json:"nitOrCedula"`
	Address            string `json:"address"`
	Phone              string `json:"phone"`
	ReceiptFooter      string `json:"receiptFooter"`
	AllowNegativeStock bool   `json:"allowNegativeStock"`
	UpdatedAt          string `json:"updatedAt"`
}

type Sale struct {
	ID            int64      `json:"id"`
	TicketNumber  string     `json:"ticketNumber"`
	TotalAmount   float64    `json:"totalAmount"`
	PaymentMethod string     `json:"paymentMethod"`
	AmountPaid    float64    `json:"amountPaid"`
	ChangeDue     float64    `json:"changeDue"`
	CustomerName  string     `json:"customerName"`
	Notes         string     `json:"notes"`
	DeviceID      string     `json:"deviceId,omitempty"`
	CreatedAt     string     `json:"createdAt"`
	Items         []SaleItem `json:"items"`
}

type SaleItem struct {
	ID          int64   `json:"id"`
	SaleID      int64   `json:"saleId"`
	ProductID   int64   `json:"productId"`
	Barcode     string  `json:"barcode"`
	ProductName string  `json:"productName"`
	Qty         int     `json:"qty"`
	UnitPrice   float64 `json:"unitPrice"`
	CostPrice   float64 `json:"costPrice"`
	Subtotal    float64 `json:"subtotal"`
}

type StockMovement struct {
	ID        int64  `json:"id"`
	ProductID int64  `json:"productId"`
	Qty       int    `json:"qty"`
	Reason    string `json:"reason"`
	SourceID  int64  `json:"sourceId"`
	Notes     string `json:"notes"`
	CreatedAt string `json:"createdAt"`
}

type CashShift struct {
	ID                    int64    `json:"id"`
	OpenedAt              string   `json:"openedAt"`
	ClosedAt              *string  `json:"closedAt"`
	InitialCash           float64  `json:"initialCash"`
	ExpectedCash          float64  `json:"expectedCash"`
	ActualCash            *float64 `json:"actualCash"`
	UnrecordedSalesAdjust float64  `json:"unrecordedSalesAdjust"`
	Status                string   `json:"status"`
	Notes                 string   `json:"notes"`
	DeviceID              string   `json:"deviceId,omitempty"`
}

type CreditAccount struct {
	ID           int64   `json:"id"`
	CustomerName string  `json:"customerName"`
	Phone        string  `json:"phone"`
	CreditLimit  float64 `json:"creditLimit"`
	CurrentDebt  float64 `json:"currentDebt"`
	Active       bool    `json:"active"`
	CreatedAt    string  `json:"createdAt"`
}

type CreditPayment struct {
	ID        int64   `json:"id"`
	AccountID int64   `json:"accountId"`
	Amount    float64 `json:"amount"`
	Notes     string  `json:"notes"`
	CreatedAt string  `json:"createdAt"`
}

type SaleInput struct {
	PaymentMethod string          `json:"paymentMethod"`
	AmountPaid    float64         `json:"amountPaid"`
	CustomerName  string          `json:"customerName"`
	Notes         string          `json:"notes"`
	Items         []SaleItemInput `json:"items"`
}

type SaleItemInput struct {
	ProductID int64 `json:"productId"`
	Qty       int   `json:"qty"`
}

func migratePOSTables(db *sql.DB) {
	schema := `
	CREATE TABLE IF NOT EXISTS store_config (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		store_name TEXT NOT NULL DEFAULT '',
		owner_name TEXT NOT NULL DEFAULT '',
		nit_or_cedula TEXT NOT NULL DEFAULT '',
		address TEXT NOT NULL DEFAULT '',
		phone TEXT NOT NULL DEFAULT '',
		receipt_footer TEXT NOT NULL DEFAULT '',
		allow_negative_stock INTEGER NOT NULL DEFAULT 0,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	INSERT OR IGNORE INTO store_config (id, store_name, allow_negative_stock) VALUES (1, 'Mi Tienda', 1);

	CREATE TABLE IF NOT EXISTS sales (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		ticket_number TEXT UNIQUE NOT NULL,
		total_amount REAL NOT NULL DEFAULT 0.0,
		payment_method TEXT NOT NULL,
		amount_paid REAL NOT NULL DEFAULT 0.0,
		change_due REAL NOT NULL DEFAULT 0.0,
		customer_name TEXT NOT NULL DEFAULT '',
		notes TEXT NOT NULL DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_sales_ticket ON sales(ticket_number);

	CREATE TABLE IF NOT EXISTS sale_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
		product_id INTEGER NOT NULL REFERENCES products(id),
		barcode TEXT NOT NULL,
		product_name TEXT NOT NULL,
		qty INTEGER NOT NULL,
		unit_price REAL NOT NULL,
		cost_price REAL NOT NULL,
		subtotal REAL NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

	CREATE TABLE IF NOT EXISTS stock_movements (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		product_id INTEGER NOT NULL REFERENCES products(id),
		qty INTEGER NOT NULL,
		reason TEXT NOT NULL,
		source_id INTEGER NOT NULL DEFAULT 0,
		notes TEXT NOT NULL DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

	CREATE TABLE IF NOT EXISTS cash_shifts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		closed_at DATETIME,
		initial_cash REAL NOT NULL DEFAULT 0.0,
		expected_cash REAL NOT NULL DEFAULT 0.0,
		actual_cash REAL,
		unrecorded_sales_adjust REAL NOT NULL DEFAULT 0.0,
		status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
		notes TEXT NOT NULL DEFAULT ''
	);
	CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_shift ON cash_shifts(status) WHERE status = 'open';

	CREATE TABLE IF NOT EXISTS credit_accounts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_name TEXT NOT NULL,
		phone TEXT NOT NULL DEFAULT '',
		credit_limit REAL NOT NULL DEFAULT 0.0,
		current_debt REAL NOT NULL DEFAULT 0.0,
		active INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_credit_accounts_customer ON credit_accounts(customer_name);

	CREATE TABLE IF NOT EXISTS credit_payments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		account_id INTEGER NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
		amount REAL NOT NULL,
		notes TEXT NOT NULL DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_credit_payments_account ON credit_payments(account_id);
	CREATE TABLE IF NOT EXISTS suppliers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		nit_or_cedula TEXT NOT NULL DEFAULT '',
		name TEXT NOT NULL,
		contact_name TEXT NOT NULL DEFAULT '',
		phone TEXT NOT NULL DEFAULT '',
		email TEXT NOT NULL DEFAULT '',
		address TEXT NOT NULL DEFAULT '',
		city TEXT NOT NULL DEFAULT '',
		payment_terms TEXT NOT NULL DEFAULT '',
		delivery_days TEXT NOT NULL DEFAULT '',
		notes TEXT NOT NULL DEFAULT '',
		active INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

	CREATE TABLE IF NOT EXISTS purchases (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
		supplier_name TEXT NOT NULL,
		invoice_number TEXT NOT NULL DEFAULT '',
		invoice_date DATETIME,
		payment_status TEXT NOT NULL DEFAULT 'unpaid',
		total_cost REAL NOT NULL DEFAULT 0.0,
		attachment_path TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'completed',
		notes TEXT NOT NULL DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME
	);
	CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
	CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(created_at);

	CREATE TABLE IF NOT EXISTS purchase_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
		product_id INTEGER NOT NULL REFERENCES products(id),
		barcode TEXT NOT NULL,
		product_name TEXT NOT NULL,
		qty INTEGER NOT NULL,
		unit_cost REAL NOT NULL,
		subtotal REAL NOT NULL,
		suggested_price REAL NOT NULL DEFAULT 0.0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
	`
	if _, err := db.Exec(schema); err != nil {
		panic(fmt.Sprintf("Error creando esquema POS: %v", err))
	}

	// Idempotent column addition for products
	_, _ = db.Exec("ALTER TABLE products ADD COLUMN is_quick_access BOOLEAN DEFAULT 0;")
	
	_, _ = db.Exec("ALTER TABLE sales ADD COLUMN device_id TEXT DEFAULT 'PC_MASTER';")
	_, _ = db.Exec("ALTER TABLE cash_shifts ADD COLUMN device_id TEXT DEFAULT 'PC_MASTER';")
}

func getStoreConfigDB(db *sql.DB) (*StoreConfig, error) {
	row := db.QueryRow("SELECT id, store_name, owner_name, nit_or_cedula, address, phone, receipt_footer, allow_negative_stock, updated_at FROM store_config WHERE id = 1")
	var cfg StoreConfig
	var allowNeg int
	err := row.Scan(&cfg.ID, &cfg.StoreName, &cfg.OwnerName, &cfg.NitOrCedula, &cfg.Address, &cfg.Phone, &cfg.ReceiptFooter, &allowNeg, &cfg.UpdatedAt)
	if err != nil {
		return nil, err
	}
	cfg.AllowNegativeStock = (allowNeg == 1)
	return &cfg, nil
}

func saveStoreConfigDB(db *sql.DB, cfg StoreConfig) error {
	allowNeg := 0
	if cfg.AllowNegativeStock {
		allowNeg = 1
	}
	_, err := db.Exec(`
		UPDATE store_config 
		SET store_name = ?, owner_name = ?, nit_or_cedula = ?, address = ?, phone = ?, receipt_footer = ?, allow_negative_stock = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = 1
	`, cfg.StoreName, cfg.OwnerName, cfg.NitOrCedula, cfg.Address, cfg.Phone, cfg.ReceiptFooter, allowNeg)
	return err
}

func completeSaleTx(db *sql.DB, input SaleInput) (*Sale, error) {
	if len(input.Items) == 0 {
		return nil, fmt.Errorf("la venta debe contener al menos un producto")
	}

	if input.PaymentMethod == "fiao" && strings.TrimSpace(input.CustomerName) == "" {
		return nil, fmt.Errorf("se requiere el nombre del cliente para ventas a crédito (fiao)")
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Generate daily consecutive ticket: REM-YYYYMMDD-0001
	today := time.Now().Format("20060102")
	prefix := fmt.Sprintf("REM-%s-", today)
	var maxSeq sql.NullInt64
	err = tx.QueryRow("SELECT MAX(CAST(SUBSTR(ticket_number, LENGTH(?) + 1) AS INTEGER)) FROM sales WHERE ticket_number LIKE ?", prefix, prefix+"%").Scan(&maxSeq)
	nextSeq := 1
	if err == nil && maxSeq.Valid && maxSeq.Int64 > 0 {
		nextSeq = int(maxSeq.Int64) + 1
	}
	ticketNumber := fmt.Sprintf("%s%04d", prefix, nextSeq)

	var totalAmount float64
	var saleItems []SaleItem

	cfg, err := getStoreConfigDB(db)
	if err != nil {
		return nil, err
	}

	for _, inputItem := range input.Items {
		var p Product
		var activeInt int
		err := tx.QueryRow("SELECT id, barcode, name, price, cost_price, stock, active FROM products WHERE id = ?", inputItem.ProductID).
			Scan(&p.ID, &p.Barcode, &p.Name, &p.Price, &p.CostPrice, &p.Stock, &activeInt)
		if err != nil {
			return nil, fmt.Errorf("producto %d no encontrado: %v", inputItem.ProductID, err)
		}

		if inputItem.Qty <= 0 {
			return nil, fmt.Errorf("la cantidad para %s debe ser mayor a 0", p.Name)
		}

		if activeInt != 1 {
			return nil, fmt.Errorf("el producto %s está inactivo o archivado", p.Name)
		}

		if !cfg.AllowNegativeStock && p.Stock < inputItem.Qty {
			return nil, fmt.Errorf("stock insuficiente para %s (disponible: %d)", p.Name, p.Stock)
		}

		subtotal := p.Price * float64(inputItem.Qty)
		totalAmount += subtotal

		saleItems = append(saleItems, SaleItem{
			ProductID:   p.ID,
			Barcode:     p.Barcode,
			ProductName: p.Name,
			Qty:         inputItem.Qty,
			UnitPrice:   p.Price,
			CostPrice:   p.CostPrice,
			Subtotal:    subtotal,
		})

		// Decrement stock
		_, err = tx.Exec("UPDATE products SET stock = stock - ? WHERE id = ?", inputItem.Qty, p.ID)
		if err != nil {
			return nil, err
		}

		// Insert stock movement
		_, err = tx.Exec("INSERT INTO stock_movements (product_id, qty, reason, notes) VALUES (?, ?, 'sale', ?)",
			p.ID, -inputItem.Qty, fmt.Sprintf("Venta %s", ticketNumber))
		if err != nil {
			return nil, err
		}
	}

	changeDue := input.AmountPaid - totalAmount
	if changeDue < 0 {
		changeDue = 0 // In case of credit or partial pay logic
	}

	res, err := tx.Exec(`
		INSERT INTO sales (ticket_number, total_amount, payment_method, amount_paid, change_due, customer_name, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, ticketNumber, totalAmount, input.PaymentMethod, input.AmountPaid, changeDue, input.CustomerName, input.Notes)
	if err != nil {
		return nil, err
	}
	saleID, _ := res.LastInsertId()

	for i := range saleItems {
		si := &saleItems[i]
		resItem, err := tx.Exec(`
			INSERT INTO sale_items (sale_id, product_id, barcode, product_name, qty, unit_price, cost_price, subtotal)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, saleID, si.ProductID, si.Barcode, si.ProductName, si.Qty, si.UnitPrice, si.CostPrice, si.Subtotal)
		if err != nil {
			return nil, err
		}
		si.ID, _ = resItem.LastInsertId()
		si.SaleID = saleID
	}

	// Cash shift update
	if input.PaymentMethod == "cash" {
		var openShiftID int64
		errShift := tx.QueryRow("SELECT id FROM cash_shifts WHERE status = 'open' LIMIT 1").Scan(&openShiftID)
		if errShift == nil {
			_, err = tx.Exec("UPDATE cash_shifts SET expected_cash = expected_cash + ? WHERE id = ?", totalAmount, openShiftID)
			if err != nil {
				return nil, err
			}
		}
	}

	// Fiao logic
	if input.PaymentMethod == "fiao" {
		var accID int64
		errAcc := tx.QueryRow("SELECT id FROM credit_accounts WHERE customer_name = ? LIMIT 1", input.CustomerName).Scan(&accID)
		if errAcc == sql.ErrNoRows {
			resAcc, err := tx.Exec("INSERT INTO credit_accounts (customer_name, current_debt) VALUES (?, ?)", input.CustomerName, totalAmount)
			if err != nil {
				return nil, err
			}
			accID, _ = resAcc.LastInsertId()
		} else if errAcc == nil {
			_, err = tx.Exec("UPDATE credit_accounts SET current_debt = current_debt + ? WHERE id = ?", totalAmount, accID)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, errAcc
		}
	}

	err = tx.Commit()
	if err != nil {
		return nil, err
	}

	return getSaleByTicketDB(db, ticketNumber)
}

func openCashShiftDB(db *sql.DB, initialCash float64, notes string) (*CashShift, error) {
	var count int
	_ = db.QueryRow("SELECT COUNT(1) FROM cash_shifts WHERE status = 'open'").Scan(&count)
	if count > 0 {
		return nil, fmt.Errorf("ya existe un turno de caja abierto")
	}

	res, err := db.Exec("INSERT INTO cash_shifts (initial_cash, expected_cash, notes) VALUES (?, ?, ?)", initialCash, initialCash, notes)
	if err != nil {
		return nil, err
	}
	_, _ = res.LastInsertId()

	return getCurrentCashShiftDB(db)
}

func getCurrentCashShiftDB(db *sql.DB) (*CashShift, error) {
	var s CashShift
	var closedAt sql.NullString
	var actualCash sql.NullFloat64

	err := db.QueryRow("SELECT id, opened_at, closed_at, initial_cash, expected_cash, actual_cash, unrecorded_sales_adjust, status, notes FROM cash_shifts WHERE status = 'open' LIMIT 1").
		Scan(&s.ID, &s.OpenedAt, &closedAt, &s.InitialCash, &s.ExpectedCash, &actualCash, &s.UnrecordedSalesAdjust, &s.Status, &s.Notes)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if closedAt.Valid {
		s.ClosedAt = &closedAt.String
	}
	if actualCash.Valid {
		s.ActualCash = &actualCash.Float64
	}
	return &s, nil
}

func closeCashShiftDB(db *sql.DB, shiftID int64, actualCash float64, assimilateDifference bool, notes string) (*CashShift, error) {
	var s CashShift
	err := db.QueryRow("SELECT expected_cash FROM cash_shifts WHERE id = ? AND status = 'open'", shiftID).Scan(&s.ExpectedCash)
	if err != nil {
		return nil, fmt.Errorf("turno no encontrado o ya cerrado")
	}

	diff := actualCash - s.ExpectedCash
	adjust := 0.0
	expected := s.ExpectedCash

	if assimilateDifference && diff > 0 {
		adjust = diff
		expected = actualCash
	}

	res, err := db.Exec(`
		UPDATE cash_shifts 
		SET closed_at = CURRENT_TIMESTAMP, actual_cash = ?, expected_cash = ?, unrecorded_sales_adjust = ?, status = 'closed', notes = ?
		WHERE id = ? AND status = 'open'
	`, actualCash, expected, adjust, notes, shiftID)

	if err != nil {
		return nil, err
	}
	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		return nil, fmt.Errorf("turno no encontrado o ya cerrado")
	}

	// Fetch updated
	var s2 CashShift
	var closedAt sql.NullString
	var finalActualCash sql.NullFloat64
	err = db.QueryRow("SELECT id, opened_at, closed_at, initial_cash, expected_cash, actual_cash, unrecorded_sales_adjust, status, notes FROM cash_shifts WHERE id = ?", shiftID).
		Scan(&s2.ID, &s2.OpenedAt, &closedAt, &s2.InitialCash, &s2.ExpectedCash, &finalActualCash, &s2.UnrecordedSalesAdjust, &s2.Status, &s2.Notes)
	if err != nil {
		return nil, err
	}
	if closedAt.Valid {
		s2.ClosedAt = &closedAt.String
	}
	if finalActualCash.Valid {
		s2.ActualCash = &finalActualCash.Float64
	}
	return &s2, nil
}

func listDailySalesDB(db *sql.DB, dateStr string) ([]Sale, error) {
	dateStr = strings.TrimSpace(dateStr)
	var rows *sql.Rows
	var err error
	if dateStr == "" {
		rows, err = db.Query("SELECT id, ticket_number, total_amount, payment_method, amount_paid, change_due, customer_name, notes, created_at FROM sales WHERE date(created_at, 'localtime') = date('now', 'localtime') ORDER BY id DESC")
	} else {
		rows, err = db.Query("SELECT id, ticket_number, total_amount, payment_method, amount_paid, change_due, customer_name, notes, created_at FROM sales WHERE (date(created_at) = date(?) OR date(created_at, 'localtime') = date(?)) ORDER BY id DESC", dateStr, dateStr)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Sale
	for rows.Next() {
		var s Sale
		err := rows.Scan(&s.ID, &s.TicketNumber, &s.TotalAmount, &s.PaymentMethod, &s.AmountPaid, &s.ChangeDue, &s.CustomerName, &s.Notes, &s.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, nil
}

func getSaleByTicketDB(db *sql.DB, ticket string) (*Sale, error) {
	var s Sale
	err := db.QueryRow("SELECT id, ticket_number, total_amount, payment_method, amount_paid, change_due, customer_name, notes, created_at FROM sales WHERE ticket_number = ?", ticket).
		Scan(&s.ID, &s.TicketNumber, &s.TotalAmount, &s.PaymentMethod, &s.AmountPaid, &s.ChangeDue, &s.CustomerName, &s.Notes, &s.CreatedAt)
	if err != nil {
		return nil, err
	}

	rows, err := db.Query("SELECT id, product_id, barcode, product_name, qty, unit_price, cost_price, subtotal FROM sale_items WHERE sale_id = ?", s.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var si SaleItem
		err := rows.Scan(&si.ID, &si.ProductID, &si.Barcode, &si.ProductName, &si.Qty, &si.UnitPrice, &si.CostPrice, &si.Subtotal)
		if err != nil {
			return nil, err
		}
		si.SaleID = s.ID
		s.Items = append(s.Items, si)
	}
	return &s, nil
}

func listCreditAccountsDB(db *sql.DB) ([]CreditAccount, error) {
	rows, err := db.Query("SELECT id, customer_name, phone, credit_limit, current_debt, active, created_at FROM credit_accounts ORDER BY customer_name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []CreditAccount
	for rows.Next() {
		var c CreditAccount
		var activeInt int
		err := rows.Scan(&c.ID, &c.CustomerName, &c.Phone, &c.CreditLimit, &c.CurrentDebt, &activeInt, &c.CreatedAt)
		if err != nil {
			return nil, err
		}
		c.Active = (activeInt == 1)
		list = append(list, c)
	}
	return list, nil
}

func recordCreditPaymentDB(db *sql.DB, accountID int64, amount float64, notes string) error {
	if amount <= 0 {
		return fmt.Errorf("el monto del abono debe ser mayor a cero")
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	var currentDebt float64
	err = tx.QueryRow("SELECT current_debt FROM credit_accounts WHERE id = ?", accountID).Scan(&currentDebt)
	if err == sql.ErrNoRows {
		return fmt.Errorf("cuenta de crédito con ID %d no encontrada", accountID)
	}
	if err != nil {
		return err
	}
	if amount > currentDebt {
		return fmt.Errorf("el abono (%.2f) excede la deuda actual (%.2f)", amount, currentDebt)
	}

	res, err := tx.Exec("UPDATE credit_accounts SET current_debt = current_debt - ? WHERE id = ?", amount, accountID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("cuenta de crédito con ID %d no encontrada", accountID)
	}

	_, err = tx.Exec("INSERT INTO credit_payments (account_id, amount, notes) VALUES (?, ?, ?)", accountID, amount, notes)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func listSuppliersDB(db *sql.DB, activeOnly bool) ([]Supplier, error) {
	query := "SELECT id, nit_or_cedula, name, contact_name, phone, email, address, city, payment_terms, delivery_days, notes, active, created_at, updated_at FROM suppliers"
	if activeOnly {
		query += " WHERE active = 1"
	}
	query += " ORDER BY name ASC"

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Supplier
	for rows.Next() {
		var s Supplier
		var activeInt int
		err := rows.Scan(&s.ID, &s.NitOrCedula, &s.Name, &s.ContactName, &s.Phone, &s.Email, &s.Address, &s.City, &s.PaymentTerms, &s.DeliveryDays, &s.Notes, &activeInt, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		s.Active = (activeInt == 1)
		list = append(list, s)
	}
	return list, nil
}

func saveSupplierDB(db *sql.DB, s Supplier) (*Supplier, error) {
	activeInt := 0
	if s.Active {
		activeInt = 1
	}

	if s.ID == 0 {
		res, err := db.Exec(`
			INSERT INTO suppliers (nit_or_cedula, name, contact_name, phone, email, address, city, payment_terms, delivery_days, notes, active)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, s.NitOrCedula, s.Name, s.ContactName, s.Phone, s.Email, s.Address, s.City, s.PaymentTerms, s.DeliveryDays, s.Notes, activeInt)
		if err != nil {
			return nil, err
		}
		s.ID, _ = res.LastInsertId()
	} else {
		_, err := db.Exec(`
			UPDATE suppliers 
			SET nit_or_cedula = ?, name = ?, contact_name = ?, phone = ?, email = ?, address = ?, city = ?, payment_terms = ?, delivery_days = ?, notes = ?, active = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, s.NitOrCedula, s.Name, s.ContactName, s.Phone, s.Email, s.Address, s.City, s.PaymentTerms, s.DeliveryDays, s.Notes, activeInt, s.ID)
		if err != nil {
			return nil, err
		}
	}
	
	err := db.QueryRow("SELECT created_at, updated_at FROM suppliers WHERE id = ?", s.ID).Scan(&s.CreatedAt, &s.UpdatedAt)
	return &s, err
}

func deleteSupplierDB(db *sql.DB, id int64) error {
	_, err := db.Exec("UPDATE suppliers SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", id)
	return err
}

func createPurchaseTx(db *sql.DB, input PurchaseInput) (*Purchase, error) {
	if len(input.Items) == 0 {
		return nil, fmt.Errorf("la compra debe contener al menos un producto")
	}

	var calculatedTotal float64
	for _, item := range input.Items {
		if item.Qty <= 0 {
			return nil, fmt.Errorf("la cantidad en compra debe ser mayor a 0 para el producto %s", item.ProductName)
		}
		if item.UnitCost < 0 {
			return nil, fmt.Errorf("el costo unitario no puede ser negativo para el producto %s", item.ProductName)
		}
		calculatedTotal += float64(item.Qty) * item.UnitCost
	}

	totalCost := input.TotalCost
	if totalCost <= 0 {
		totalCost = calculatedTotal
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Insert header
	res, err := tx.Exec(`
		INSERT INTO purchases (supplier_id, supplier_name, invoice_number, invoice_date, payment_status, total_cost, attachment_path, notes, completed_at)
		VALUES (?, (SELECT name FROM suppliers WHERE id = ?), ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, input.SupplierID, input.SupplierID, input.InvoiceNumber, input.InvoiceDate, input.PaymentStatus, totalCost, input.AttachmentPath, input.Notes)
	if err != nil {
		return nil, err
	}
	purchaseID, _ := res.LastInsertId()

	var purchaseItems []PurchaseItem

	for _, item := range input.Items {
		subtotal := float64(item.Qty) * item.UnitCost
		resItem, err := tx.Exec(`
			INSERT INTO purchase_items (purchase_id, product_id, barcode, product_name, qty, unit_cost, subtotal, suggested_price)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, purchaseID, item.ProductID, item.Barcode, item.ProductName, item.Qty, item.UnitCost, subtotal, item.SuggestedPrice)
		if err != nil {
			return nil, err
		}
		itemID, _ := resItem.LastInsertId()
		purchaseItems = append(purchaseItems, PurchaseItem{
			ID: itemID, PurchaseID: purchaseID, ProductID: item.ProductID, Barcode: item.Barcode, ProductName: item.ProductName,
			Qty: item.Qty, UnitCost: item.UnitCost, Subtotal: subtotal, SuggestedPrice: item.SuggestedPrice,
		})

		// Update product
		updateQ := "UPDATE products SET stock = stock + ?, cost_price = ?"
		args := []interface{}{item.Qty, item.UnitCost}
		if item.SuggestedPrice > 0 {
			updateQ += ", price = ?"
			args = append(args, item.SuggestedPrice)
		}
		updateQ += " WHERE id = ?"
		args = append(args, item.ProductID)
		
		resUpd, err := tx.Exec(updateQ, args...)
		if err != nil {
			return nil, err
		}
		rowsUpd, _ := resUpd.RowsAffected()
		if rowsUpd == 0 {
			return nil, fmt.Errorf("producto con ID %d no existe", item.ProductID)
		}

		// Insert stock movement
		_, err = tx.Exec("INSERT INTO stock_movements (product_id, qty, reason, source_id, notes) VALUES (?, ?, 'purchase', ?, ?)",
			item.ProductID, item.Qty, purchaseID, fmt.Sprintf("Compra - Fra %s", input.InvoiceNumber))
		if err != nil {
			return nil, err
		}
	}

	err = tx.Commit()
	if err != nil {
		return nil, err
	}

	// Fetch full purchase
	return getPurchaseDB(db, purchaseID)
}

func getPurchaseDB(db *sql.DB, id int64) (*Purchase, error) {
	var p Purchase
	var completedAt sql.NullString
	err := db.QueryRow("SELECT id, supplier_id, supplier_name, invoice_number, invoice_date, payment_status, total_cost, attachment_path, status, notes, created_at, completed_at FROM purchases WHERE id = ?", id).
		Scan(&p.ID, &p.SupplierID, &p.SupplierName, &p.InvoiceNumber, &p.InvoiceDate, &p.PaymentStatus, &p.TotalCost, &p.AttachmentPath, &p.Status, &p.Notes, &p.CreatedAt, &completedAt)
	if err != nil {
		return nil, err
	}
	if completedAt.Valid {
		p.CompletedAt = &completedAt.String
	}

	rows, err := db.Query("SELECT id, purchase_id, product_id, barcode, product_name, qty, unit_cost, subtotal, suggested_price, created_at FROM purchase_items WHERE purchase_id = ?", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var pi PurchaseItem
		err := rows.Scan(&pi.ID, &pi.PurchaseID, &pi.ProductID, &pi.Barcode, &pi.ProductName, &pi.Qty, &pi.UnitCost, &pi.Subtotal, &pi.SuggestedPrice, &pi.CreatedAt)
		if err != nil {
			return nil, err
		}
		p.Items = append(p.Items, pi)
	}
	return &p, nil
}

func listPurchasesDB(db *sql.DB, limit int) ([]Purchase, error) {
	query := "SELECT id, supplier_id, supplier_name, invoice_number, invoice_date, payment_status, total_cost, attachment_path, status, notes, created_at, completed_at FROM purchases ORDER BY id DESC"
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Purchase
	for rows.Next() {
		var p Purchase
		var completedAt sql.NullString
		err := rows.Scan(&p.ID, &p.SupplierID, &p.SupplierName, &p.InvoiceNumber, &p.InvoiceDate, &p.PaymentStatus, &p.TotalCost, &p.AttachmentPath, &p.Status, &p.Notes, &p.CreatedAt, &completedAt)
		if err != nil {
			return nil, err
		}
		if completedAt.Valid {
			p.CompletedAt = &completedAt.String
		}
		list = append(list, p)
	}
	return list, nil
}

func getFinancialReportsDB(db *sql.DB, period string) (*ReportSummary, error) {
	var dateFilter string
	switch period {
	case "week":
		dateFilter = "date(created_at) >= date('now', '-7 days')"
	case "month":
		dateFilter = "date(created_at) >= date('now', 'start of month')"
	case "year":
		dateFilter = "date(created_at) >= date('now', 'start of year')"
	default:
		dateFilter = "1=1" // all time
	}

	summary := ReportSummary{Period: period}
	
	// Sales
	salesQ := fmt.Sprintf("SELECT IFNULL(SUM(total_amount), 0), COUNT(id) FROM sales WHERE %s", dateFilter)
	err := db.QueryRow(salesQ).Scan(&summary.TotalSales, &summary.SalesCount)
	if err != nil {
		return nil, err
	}
	
	// Cost of sales
	costQ := fmt.Sprintf("SELECT IFNULL(SUM(si.cost_price * si.qty), 0) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE %s", strings.ReplaceAll(dateFilter, "created_at", "s.created_at"))
	var totalCostOfSales float64
	err = db.QueryRow(costQ).Scan(&totalCostOfSales)
	if err != nil {
		return nil, err
	}
	
	// Purchases
	purchasesQ := fmt.Sprintf("SELECT IFNULL(SUM(total_cost), 0), COUNT(id) FROM purchases WHERE %s", dateFilter)
	err = db.QueryRow(purchasesQ).Scan(&summary.TotalPurchases, &summary.PurchasesCount)
	if err != nil {
		return nil, err
	}

	summary.GrossMargin = summary.TotalSales - totalCostOfSales
	if summary.TotalSales > 0 {
		summary.GrossMarginPct = (summary.GrossMargin / summary.TotalSales) * 100
	}
	if summary.SalesCount > 0 {
		summary.AverageTicket = summary.TotalSales / float64(summary.SalesCount)
	}

	summary.DianUvtThreshold = 3500.0 * 49799.0 // ~ 174,296,500 COP
	var annualSales float64
	_ = db.QueryRow("SELECT IFNULL(SUM(total_amount), 0) FROM sales WHERE date(created_at) >= date('now', 'start of year')").Scan(&annualSales)
	if annualSales > 0 && summary.DianUvtThreshold > 0 {
		summary.DianCurrentPct = (annualSales / summary.DianUvtThreshold) * 100
	} else if summary.TotalSales > 0 && summary.DianUvtThreshold > 0 {
		summary.DianCurrentPct = (summary.TotalSales / summary.DianUvtThreshold) * 100
	}

	return &summary, nil
}

func ingestSyncedSaleTx(db *sql.DB, s Sale) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var exists int
	err = tx.QueryRow("SELECT 1 FROM sales WHERE ticket_number = ?", s.TicketNumber).Scan(&exists)
	if err == nil && exists == 1 {
		return nil // Idempotent: already ingested
	}

	devID := s.DeviceID
	if devID == "" {
		devID = "SUNMI_POS"
	}

	res, err := tx.Exec(`
		INSERT INTO sales (ticket_number, total_amount, payment_method, amount_paid, change_due, customer_name, notes, created_at, device_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.TicketNumber, s.TotalAmount, s.PaymentMethod, s.AmountPaid, s.ChangeDue, s.CustomerName, s.Notes, s.CreatedAt, devID)
	if err != nil {
		return fmt.Errorf("error inserting sale: %w", err)
	}

	saleID, _ := res.LastInsertId()

	for _, item := range s.Items {
		_, err = tx.Exec(`
			INSERT INTO sale_items (sale_id, product_id, barcode, product_name, qty, unit_price, cost_price, subtotal)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, saleID, item.ProductID, item.Barcode, item.ProductName, item.Qty, item.UnitPrice, item.CostPrice, item.Subtotal)
		if err != nil {
			return fmt.Errorf("error inserting sale item: %w", err)
		}

		_, err = tx.Exec(`
			INSERT INTO stock_movements (product_id, qty, reason, source_id, notes, created_at)
			VALUES (?, ?, 'sync_sale', ?, 'Ingested sale', ?)
		`, item.ProductID, -item.Qty, saleID, s.CreatedAt)
		if err != nil {
			return fmt.Errorf("error inserting stock movement: %w", err)
		}

		_, err = tx.Exec("UPDATE products SET stock = stock - ? WHERE id = ?", item.Qty, item.ProductID)
		if err != nil {
			return fmt.Errorf("error updating stock: %w", err)
		}
	}

	return tx.Commit()
}

func ingestSyncedShiftTx(db *sql.DB, s CashShift) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Use opened_at and initial_cash as unique identifier if ID is from another DB.
	// But actually, we don't know the remote ID vs local ID. Let's just assume we check by opened_at for idempotency.
	var exists int
	err = tx.QueryRow("SELECT 1 FROM cash_shifts WHERE opened_at = ? AND initial_cash = ?", s.OpenedAt, s.InitialCash).Scan(&exists)
	if err == nil && exists == 1 {
		return nil // Idempotent
	}

	devID := s.DeviceID
	if devID == "" {
		devID = "SUNMI_POS"
	}

	_, err = tx.Exec(`
		INSERT INTO cash_shifts (opened_at, closed_at, initial_cash, expected_cash, actual_cash, unrecorded_sales_adjust, status, notes, device_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.OpenedAt, s.ClosedAt, s.InitialCash, s.ExpectedCash, s.ActualCash, s.UnrecordedSalesAdjust, s.Status, s.Notes, devID)
	if err != nil {
		return fmt.Errorf("error inserting cash shift: %w", err)
	}

	return tx.Commit()
}

// --- Catalog Import & Smart Barcode Linking ---

func cleanCSVNumber(val string) float64 {
	val = strings.TrimSpace(val)
	val = strings.ReplaceAll(val, "$", "")
	val = strings.ReplaceAll(val, " ", "")
	if val == "" || strings.Contains(strings.ToUpper(val), "PENDIENTE") {
		return 0
	}
	if strings.Contains(val, ",") && !strings.Contains(val, ".") {
		parts := strings.Split(val, ",")
		if len(parts) == 2 && len(parts[1]) == 3 {
			val = strings.ReplaceAll(val, ",", "")
		} else if len(parts) > 2 {
			val = strings.ReplaceAll(val, ",", "")
		} else {
			val = strings.ReplaceAll(val, ",", ".")
		}
	} else if strings.Contains(val, ".") && strings.Contains(val, ",") {
		lastDot := strings.LastIndex(val, ".")
		lastComma := strings.LastIndex(val, ",")
		if lastComma > lastDot {
			val = strings.ReplaceAll(val, ".", "")
			val = strings.ReplaceAll(val, ",", ".")
		} else {
			val = strings.ReplaceAll(val, ",", "")
		}
	} else if strings.Contains(val, ".") {
		parts := strings.Split(val, ".")
		if len(parts) > 2 {
			val = strings.Join(parts, "")
		} else if len(parts) == 2 && len(parts[1]) == 3 {
			val = strings.Join(parts, "")
		}
	}
	f, _ := strconv.ParseFloat(val, 64)
	return f
}

func isCatalogBulkItem(normName string, cat string) bool {
	upper := strings.ToUpper(normName)
	catUpper := strings.ToUpper(cat)
	if strings.Contains(upper, "HUEVO") ||
		strings.HasPrefix(upper, "PAN ") || strings.Contains(upper, "PAN ARTESANAL") || strings.Contains(upper, "PAN ROLLO") ||
		strings.Contains(upper, "CARNE DE RES") || strings.Contains(upper, "PECHUGA") || strings.Contains(upper, "YUCA") ||
		strings.Contains(upper, "BOMBÓN") || strings.Contains(upper, "BOMBON") || strings.Contains(upper, "GOMITA") ||
		strings.Contains(upper, "BOLSA") || strings.Contains(upper, "FÓSFORO") || strings.Contains(upper, "FOSFORO") {
		return true
	}
	if strings.Contains(catUpper, "CARNES") && (strings.Contains(upper, "LB") || strings.Contains(upper, "KILO")) {
		return true
	}
	return false
}

func importCatalogCSVTx(db *sql.DB, csvContent string) (*ImportCatalogResult, error) {
	csvContent = strings.TrimPrefix(csvContent, "\ufeff")
	csvContent = strings.TrimPrefix(csvContent, "\xef\xbb\xbf")
	csvContent = strings.TrimSpace(csvContent)
	if csvContent == "" {
		return &ImportCatalogResult{}, fmt.Errorf("el contenido CSV está vacío")
	}

	r := csv.NewReader(strings.NewReader(csvContent))
	firstLine := strings.SplitN(csvContent, "\n", 2)[0]
	if strings.Count(firstLine, ";") > strings.Count(firstLine, ",") {
		r.Comma = ';'
	} else {
		r.Comma = ','
	}
	r.FieldsPerRecord = -1
	r.TrimLeadingSpace = true

	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("error al interpretar archivo CSV: %w", err)
	}
	if len(records) < 2 {
		return &ImportCatalogResult{}, fmt.Errorf("el archivo CSV no contiene registros de datos")
	}

	header := records[0]
	colMap := make(map[string]int)
	for idx, col := range header {
		cleanCol := strings.ToUpper(strings.TrimSpace(strings.TrimPrefix(col, "\ufeff")))
		colMap[cleanCol] = idx
	}

	getCol := func(names ...string) int {
		for _, name := range names {
			if idx, ok := colMap[name]; ok {
				return idx
			}
		}
		return -1
	}

	nameIdx := getCol("ARTICULO", "PRODUCTO", "NOMBRE", "NAME", "DESCRIPCION")
	catIdx := getCol("CATEGORIA", "CATEGORY", "DEPARTAMENTO")
	costIdx := getCol("PRECIO_COSTO_COP", "PRECIO_COSTO", "COSTO", "COST_PRICE")
	priceIdx := getCol("PRECIO_VENTA_SUGERIDO_COP", "PRECIO_VENTA", "PRECIO", "PRICE", "SUGGESTED_PRICE")
	stockIdx := getCol("CANTIDAD_STOCK", "STOCK", "CANTIDAD", "QTY")
	shelfIdx := getCol("ESTANTE_ORIGINAL", "ESTANTE", "UBICACION", "LOCACION", "LOCATION")
	barcodeIdx := getCol("BARCODE", "CODIGO", "CODIGO_BARRAS", "EAN")

	if nameIdx == -1 {
		return nil, fmt.Errorf("columna requerida 'ARTICULO' o 'NOMBRE' no encontrada en el CSV")
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	type existingProdInfo struct {
		id            int64
		barcode       string
		costPrice     float64
		price         float64
		stock         int
		category      string
		location      string
		isQuickAccess bool
	}

	existingByName := make(map[string]existingProdInfo)
	existingBarcodes := make(map[string]bool)

	rows, err := tx.Query("SELECT id, barcode, name, cost_price, price, stock, category, location, is_quick_access FROM products")
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var p existingProdInfo
		var name string
		var quick sql.NullInt64
		if err := rows.Scan(&p.id, &p.barcode, &name, &p.costPrice, &p.price, &p.stock, &p.category, &p.location, &quick); err == nil {
			p.isQuickAccess = (quick.Valid && quick.Int64 == 1)
			norm := strings.ToUpper(strings.Join(strings.Fields(name), " "))
			existingByName[norm] = p
			existingBarcodes[p.barcode] = true
		}
	}
	rows.Close()

	var maxID sql.NullInt64
	_ = tx.QueryRow("SELECT MAX(id) FROM products").Scan(&maxID)
	nextSeq := int64(1)
	if maxID.Valid {
		nextSeq = maxID.Int64 + 1
	}

	generateInternalBarcode := func() string {
		for {
			code := fmt.Sprintf("ILUZ-%04d", nextSeq)
			nextSeq++
			if !existingBarcodes[code] {
				existingBarcodes[code] = true
				return code
			}
		}
	}

	result := &ImportCatalogResult{
		Errors: make([]string, 0),
	}

	stmtInsert, err := tx.Prepare(`
		INSERT INTO products (barcode, name, category, cost_price, price, stock, location, active, is_quick_access)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
	`)
	if err != nil {
		return nil, err
	}
	defer stmtInsert.Close()

	stmtUpdate, err := tx.Prepare(`
		UPDATE products SET
			category = CASE WHEN category = '' THEN ? ELSE category END,
			cost_price = CASE WHEN cost_price = 0 THEN ? ELSE cost_price END,
			price = CASE WHEN price = 0 THEN ? ELSE price END,
			stock = CASE WHEN stock = 0 THEN ? ELSE stock END,
			location = CASE WHEN location = '' THEN ? ELSE location END,
			is_quick_access = CASE WHEN is_quick_access = 0 AND ? = 1 THEN 1 ELSE is_quick_access END
		WHERE id = ?
	`)
	if err != nil {
		return nil, err
	}
	defer stmtUpdate.Close()

	for rowIdx, record := range records[1:] {
		if nameIdx >= len(record) {
			continue
		}
		rawName := strings.TrimSpace(record[nameIdx])
		if rawName == "" {
			continue
		}

		normName := strings.ToUpper(strings.Join(strings.Fields(rawName), " "))

		var cat, shelf, customBarcode string
		var cost, price float64
		var stock int

		if catIdx != -1 && catIdx < len(record) {
			cat = strings.TrimSpace(record[catIdx])
		}
		if costIdx != -1 && costIdx < len(record) {
			cost = cleanCSVNumber(record[costIdx])
		}
		if priceIdx != -1 && priceIdx < len(record) {
			price = cleanCSVNumber(record[priceIdx])
		}
		if stockIdx != -1 && stockIdx < len(record) {
			stock = int(cleanCSVNumber(record[stockIdx]))
		}
		if shelfIdx != -1 && shelfIdx < len(record) {
			shelf = strings.TrimSpace(record[shelfIdx])
		}
		if barcodeIdx != -1 && barcodeIdx < len(record) {
			customBarcode = strings.TrimSpace(record[barcodeIdx])
		}

		quickAccess := 0
		if isCatalogBulkItem(rawName, cat) {
			quickAccess = 1
		}

		if existing, found := existingByName[normName]; found {
			_, err := stmtUpdate.Exec(cat, cost, price, stock, shelf, quickAccess, existing.id)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Fila %d: error actualizando '%s': %v", rowIdx+2, rawName, err))
			} else {
				result.Updated++
			}
		} else {
			barcodeToUse := ""
			if customBarcode != "" && !existingBarcodes[customBarcode] {
				barcodeToUse = customBarcode
				existingBarcodes[customBarcode] = true
			} else {
				barcodeToUse = generateInternalBarcode()
			}

			res, err := stmtInsert.Exec(barcodeToUse, rawName, cat, cost, price, stock, shelf, quickAccess)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Fila %d: error insertando '%s': %v", rowIdx+2, rawName, err))
			} else {
				newID, _ := res.LastInsertId()
				existingByName[normName] = existingProdInfo{
					id:            newID,
					barcode:       barcodeToUse,
					costPrice:     cost,
					price:         price,
					stock:         stock,
					category:      cat,
					location:      shelf,
					isQuickAccess: (quickAccess == 1),
				}
				result.Inserted++
			}
		}
		result.TotalProcessed++
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("error confirmando importación: %w", err)
	}

	return result, nil
}

func linkBarcodeToProductDB(db *sql.DB, productID int64, barcode string) error {
	barcode = strings.TrimSpace(barcode)
	if barcode == "" {
		return fmt.Errorf("el código de barras no puede estar vacío")
	}
	if productID <= 0 {
		return fmt.Errorf("ID de producto inválido")
	}

	var existingID int64
	var existingName string
	err := db.QueryRow("SELECT id, name FROM products WHERE barcode = ? AND id != ?", barcode, productID).Scan(&existingID, &existingName)
	if err == nil {
		return fmt.Errorf("el código de barras '%s' ya está asignado al producto '%s'", barcode, existingName)
	}
	if err != sql.ErrNoRows {
		return err
	}

	var curName string
	err = db.QueryRow("SELECT name FROM products WHERE id = ?", productID).Scan(&curName)
	if err == sql.ErrNoRows {
		return fmt.Errorf("producto con ID %d no encontrado", productID)
	}
	if err != nil {
		return err
	}

	_, err = db.Exec("UPDATE products SET barcode = ? WHERE id = ?", barcode, productID)
	if err != nil {
		return fmt.Errorf("error al vincular código de barras: %w", err)
	}

	_, _ = db.Exec("UPDATE inventory_session_items SET barcode = ? WHERE product_id = ?", barcode, productID)
	return nil
}

