package main

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"fmt"
	"log"
	"strconv"
	"strings"

	_ "modernc.org/sqlite"
)

type Product struct {
	ID            int64   `json:"id"`
	Barcode       string  `json:"barcode"`
	Name          string  `json:"name"`
	Price         float64 `json:"price"`
	Stock         int     `json:"stock"`
	Weight        float64 `json:"weight"`
	Size          string  `json:"size"`
	UnitOfMeasure string  `json:"unitOfMeasure"`
	Color         string  `json:"color"`
	Location      string  `json:"location"`
	Active        bool    `json:"active"`
}

type Location struct {
	ID          int64  `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
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
		price           REAL NOT NULL DEFAULT 0.0,
		stock           INTEGER NOT NULL DEFAULT 0,
		weight          REAL NOT NULL DEFAULT 0.0,
		size            TEXT NOT NULL DEFAULT '',
		unit_of_measure TEXT NOT NULL DEFAULT 'und',
		color           TEXT NOT NULL DEFAULT '',
		location        TEXT NOT NULL DEFAULT '',
		active          INTEGER NOT NULL DEFAULT 1
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
		counted_at      DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err := db.Exec(baseSchema); err != nil {
		log.Fatalf("Error creando esquema base: %v", err)
	}

	migrateProductsTable(db)

	indexes := `
	CREATE INDEX IF NOT EXISTS idx_products_location ON products(location);
	CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
	CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session ON inventory_sessions(status) WHERE status = 'in_progress';
	CREATE INDEX IF NOT EXISTS idx_inv_items_session ON inventory_session_items(session_id);
	CREATE INDEX IF NOT EXISTS idx_inv_items_counted ON inventory_session_items(session_id, is_counted);
	CREATE INDEX IF NOT EXISTS idx_inv_items_barcode ON inventory_session_items(session_id, barcode);
	CREATE INDEX IF NOT EXISTS idx_count_entries_item ON inventory_count_entries(session_item_id);
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
		"weight":          "REAL NOT NULL DEFAULT 0.0",
		"size":            "TEXT NOT NULL DEFAULT ''",
		"unit_of_measure": "TEXT NOT NULL DEFAULT 'und'",
		"color":           "TEXT NOT NULL DEFAULT ''",
		"location":        "TEXT NOT NULL DEFAULT ''",
		"active":          "INTEGER NOT NULL DEFAULT 1",
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
			return sku, nil
		}
		nextID++
	}
}

func getProductByBarcode(db *sql.DB, barcode string) (*Product, error) {
	query := `
	SELECT id, barcode, name, price, stock, weight, size, unit_of_measure, color, location, active
	FROM products
	WHERE barcode = ?
	LIMIT 1`
	row := db.QueryRow(query, strings.TrimSpace(barcode))

	var p Product
	var activeInt int
	err := row.Scan(
		&p.ID,
		&p.Barcode,
		&p.Name,
		&p.Price,
		&p.Stock,
		&p.Weight,
		&p.Size,
		&p.UnitOfMeasure,
		&p.Color,
		&p.Location,
		&activeInt,
	)
	if err != nil {
		return nil, err
	}
	p.Active = (activeInt == 1)
	return &p, nil
}

func saveOrUpdateProduct(db *sql.DB, p Product) error {
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

	if p.ID > 0 {
		query := `
		UPDATE products SET
			barcode = ?,
			name = ?,
			price = ?,
			stock = ?,
			weight = ?,
			size = ?,
			unit_of_measure = ?,
			color = ?,
			location = ?,
			active = ?
		WHERE id = ?;
		`
		_, err := db.Exec(
			query,
			p.Barcode,
			p.Name,
			p.Price,
			p.Stock,
			p.Weight,
			p.Size,
			p.UnitOfMeasure,
			p.Color,
			p.Location,
			activeInt,
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

	query := `
	INSERT INTO products (barcode, name, price, stock, weight, size, unit_of_measure, color, location, active)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(barcode) DO UPDATE SET
		name = excluded.name,
		price = excluded.price,
		stock = excluded.stock,
		weight = excluded.weight,
		size = excluded.size,
		unit_of_measure = excluded.unit_of_measure,
		color = excluded.color,
		location = excluded.location,
		active = excluded.active;
	`
	_, err := db.Exec(
		query,
		p.Barcode,
		p.Name,
		p.Price,
		p.Stock,
		p.Weight,
		p.Size,
		p.UnitOfMeasure,
		p.Color,
		p.Location,
		activeInt,
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
		SELECT id, barcode, name, price, stock, weight, size, unit_of_measure, color, location, active
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
		SELECT id, barcode, name, price, stock, weight, size, unit_of_measure, color, location, active
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
		SELECT id, barcode, name, price, stock, weight, size, unit_of_measure, color, location, active
		FROM products
		WHERE active = 1 AND (barcode LIKE ? OR name LIKE ? OR location LIKE ?)
		ORDER BY name ASC
		LIMIT 20
	`, term, term, term)
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
		err := rows.Scan(
			&p.ID,
			&p.Barcode,
			&p.Name,
			&p.Price,
			&p.Stock,
			&p.Weight,
			&p.Size,
			&p.UnitOfMeasure,
			&p.Color,
			&p.Location,
			&activeInt,
		)
		if err != nil {
			return nil, err
		}
		p.Active = (activeInt == 1)
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
		_, err = tx.Exec(`
			INSERT INTO inventory_session_items (
				session_id, product_id, barcode, product_name, location, unit_price, system_stock_at_start, counted_qty, is_counted
			)
			SELECT ?, id, barcode, name, location, price, stock, 0, 0
			FROM products
			WHERE active = 1 AND location = ?
			ORDER BY name ASC;
		`, sessionID, scope)
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

		// Fetch location breakdown
		entryRows, err := db.Query(`
			SELECT location_code, SUM(qty)
			FROM inventory_count_entries
			WHERE session_item_id = ?
			GROUP BY location_code
			ORDER BY location_code ASC;
		`, item.ID)
		if err == nil {
			var parts []string
			for entryRows.Next() {
				var loc string
				var sumQty int
				if err := entryRows.Scan(&loc, &sumQty); err == nil {
					if loc == "" {
						loc = "General"
					}
					parts = append(parts, fmt.Sprintf("%s: %d", loc, sumQty))
				}
			}
			entryRows.Close()
			item.Breakdown = strings.Join(parts, ", ")
		}

		list = append(list, item)
	}

	return list, nil
}

func recordInventoryCountEntry(db *sql.DB, sessionItemId int64, locationCode string, qty int, replace bool) error {
	if qty < 0 {
		return fmt.Errorf("la cantidad contada no puede ser negativa")
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

	var entryID int64
	var curQty int
	err = tx.QueryRow(`
		SELECT id, qty FROM inventory_count_entries 
		WHERE session_item_id = ? AND location_code = ? 
		LIMIT 1;
	`, sessionItemId, loc).Scan(&entryID, &curQty)

	if err == sql.ErrNoRows {
		_, err = tx.Exec(`
			INSERT INTO inventory_count_entries (session_item_id, location_code, qty)
			VALUES (?, ?, ?);
		`, sessionItemId, loc, qty)
		if err != nil {
			return err
		}
	} else if err == nil {
		newQty := curQty + qty
		if replace {
			newQty = qty
		}
		_, err = tx.Exec(`
			UPDATE inventory_count_entries 
			SET qty = ?, counted_at = CURRENT_TIMESTAMP
			WHERE id = ?;
		`, newQty, entryID)
		if err != nil {
			return err
		}
	} else {
		return err
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
		SELECT id, product_id, counted_qty, is_counted 
		FROM inventory_session_items 
		WHERE session_id = ?;
	`, sessionId)
	if err != nil {
		return err
	}
	defer rows.Close()

	type itemCloseData struct {
		id         int64
		productID  int64
		countedQty int
		isCounted  bool
	}
	var items []itemCloseData
	for rows.Next() {
		var it itemCloseData
		var isCountedInt int
		if err := rows.Scan(&it.id, &it.productID, &it.countedQty, &isCountedInt); err == nil {
			it.isCounted = (isCountedInt == 1)
			items = append(items, it)
		}
	}
	rows.Close()

	for _, it := range items {
		// Safety Guardrail: Only apply stock update if explicitly checked AND is_counted == true
		if toUpdateMap[it.productID] && it.isCounted {
			_, err = tx.Exec("UPDATE products SET stock = ? WHERE id = ?;", it.countedQty, it.productID)
			if err != nil {
				return fmt.Errorf("error actualizando stock de producto #%d: %w", it.productID, err)
			}
			_, err = tx.Exec("UPDATE inventory_session_items SET adjustment_applied = 1, stock_after = ? WHERE id = ?;", it.countedQty, it.id)
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
	_, err := db.Exec(`
		UPDATE inventory_sessions 
		SET status = 'cancelled', closed_at = CURRENT_TIMESTAMP 
		WHERE id = ? AND status = 'in_progress';
	`, sessionId)
	return err
}

func listCompletedSessions(db *sql.DB) ([]InventorySession, error) {
	rows, err := db.Query(`
		SELECT id, name, responsible, scope, notes, status, started_at, closed_at
		FROM inventory_sessions
		WHERE status IN ('completed', 'cancelled')
		ORDER BY id DESC;
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]InventorySession, 0)
	for rows.Next() {
		var s InventorySession
		var closedAt sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &s.Responsible, &s.Scope, &s.Notes, &s.Status, &s.StartedAt, &closedAt); err != nil {
			return nil, err
		}
		if closedAt.Valid {
			s.ClosedAt = &closedAt.String
		}
		_ = db.QueryRow("SELECT COUNT(1), COALESCE(SUM(is_counted), 0) FROM inventory_session_items WHERE session_id = ?", s.ID).Scan(&s.TotalItems, &s.CountedItems)
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
