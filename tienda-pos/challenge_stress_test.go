package main

import (
	"database/sql"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestChallenge_ActiveFlagDirectMatrix systematically verifies the active column
// in raw SQLite across all insertion and update paths.
func TestChallenge_ActiveFlagDirectMatrix(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Insert new product (ID: 0) with Active: false
	p1 := Product{
		ID:            0,
		Barcode:       "CHALLENGE-001",
		Name:          "Challenge Item 1",
		Price:         100.0,
		Stock:         10,
		UnitOfMeasure: "und",
		Active:        false,
	}
	if err := saveOrUpdateProduct(db, p1); err != nil {
		t.Fatalf("saveOrUpdateProduct failed for p1: %v", err)
	}

	var rawActive1 int
	if err := db.QueryRow("SELECT active FROM products WHERE barcode = ?", "CHALLENGE-001").Scan(&rawActive1); err != nil {
		t.Fatalf("failed querying raw active for p1: %v", err)
	}
	if rawActive1 != 0 {
		t.Errorf("expected rawActive1 == 0, got %d", rawActive1)
	}

	// 2. Insert new product (ID: 0) with Active: true
	p2 := Product{
		ID:            0,
		Barcode:       "CHALLENGE-002",
		Name:          "Challenge Item 2",
		Price:         200.0,
		Stock:         20,
		UnitOfMeasure: "und",
		Active:        true,
	}
	if err := saveOrUpdateProduct(db, p2); err != nil {
		t.Fatalf("saveOrUpdateProduct failed for p2: %v", err)
	}

	var rawActive2 int
	if err := db.QueryRow("SELECT active FROM products WHERE barcode = ?", "CHALLENGE-002").Scan(&rawActive2); err != nil {
		t.Fatalf("failed querying raw active for p2: %v", err)
	}
	if rawActive2 != 1 {
		t.Errorf("expected rawActive2 == 1, got %d", rawActive2)
	}

	// 3. Update existing product by ID from Active: true to Active: false
	saved2, err := getProductByBarcode(db, "CHALLENGE-002")
	if err != nil || saved2.ID == 0 {
		t.Fatalf("failed fetching saved2: %v", err)
	}
	saved2.Active = false
	if err := saveOrUpdateProduct(db, *saved2); err != nil {
		t.Fatalf("failed updating saved2 to inactive: %v", err)
	}

	var rawActive2After int
	if err := db.QueryRow("SELECT active FROM products WHERE id = ?", saved2.ID).Scan(&rawActive2After); err != nil {
		t.Fatalf("failed querying raw active for saved2 after update: %v", err)
	}
	if rawActive2After != 0 {
		t.Errorf("expected rawActive2After == 0, got %d", rawActive2After)
	}

	// 4. Update existing product by ID from Active: false to Active: true
	saved2.Active = true
	if err := saveOrUpdateProduct(db, *saved2); err != nil {
		t.Fatalf("failed updating saved2 to active: %v", err)
	}
	if err := db.QueryRow("SELECT active FROM products WHERE id = ?", saved2.ID).Scan(&rawActive2After); err != nil {
		t.Fatalf("failed querying raw active for saved2 after reactivation: %v", err)
	}
	if rawActive2After != 1 {
		t.Errorf("expected rawActive2After == 1, got %d", rawActive2After)
	}

	// 5. Conflict upsert (ID: 0) with Active: false on an active product
	upsertInactive := Product{
		ID:            0,
		Barcode:       "CHALLENGE-002",
		Name:          "Challenge Item 2 Upsert Inactive",
		Price:         250.0,
		Stock:         25,
		UnitOfMeasure: "und",
		Active:        false,
	}
	if err := saveOrUpdateProduct(db, upsertInactive); err != nil {
		t.Fatalf("failed conflict upsert with Active: false: %v", err)
	}
	if err := db.QueryRow("SELECT active FROM products WHERE barcode = ?", "CHALLENGE-002").Scan(&rawActive2After); err != nil {
		t.Fatalf("failed querying raw active after conflict upsert: %v", err)
	}
	if rawActive2After != 0 {
		t.Errorf("expected rawActive2After == 0 after conflict upsert, got %d", rawActive2After)
	}

	// 6. Conflict upsert (ID: 0) with Active: false on ALREADY INACTIVE product
	// Must NOT resurrect the item!
	upsertInactiveAgain := Product{
		ID:            0,
		Barcode:       "CHALLENGE-002",
		Name:          "Challenge Item 2 Still Inactive",
		Price:         260.0,
		Stock:         30,
		UnitOfMeasure: "und",
		Active:        false,
	}
	if err := saveOrUpdateProduct(db, upsertInactiveAgain); err != nil {
		t.Fatalf("failed second conflict upsert with Active: false: %v", err)
	}
	if err := db.QueryRow("SELECT active FROM products WHERE barcode = ?", "CHALLENGE-002").Scan(&rawActive2After); err != nil {
		t.Fatalf("failed querying raw active after second upsert: %v", err)
	}
	if rawActive2After != 0 {
		t.Errorf("CRITICAL: conflict upsert resurrected inactive product to %d", rawActive2After)
	}

	// 7. Conflict upsert (ID: 0) with Active: true explicitly reactivates
	upsertReactivate := Product{
		ID:            0,
		Barcode:       "CHALLENGE-002",
		Name:          "Challenge Item 2 Reactivated",
		Price:         270.0,
		Stock:         35,
		UnitOfMeasure: "und",
		Active:        true,
	}
	if err := saveOrUpdateProduct(db, upsertReactivate); err != nil {
		t.Fatalf("failed reactivating conflict upsert: %v", err)
	}
	if err := db.QueryRow("SELECT active FROM products WHERE barcode = ?", "CHALLENGE-002").Scan(&rawActive2After); err != nil {
		t.Fatalf("failed querying raw active after reactivating upsert: %v", err)
	}
	if rawActive2After != 1 {
		t.Errorf("expected rawActive2After == 1 after reactivating upsert, got %d", rawActive2After)
	}

	// 8. Auto-generated SKU with Barcode: "" and Active: false
	skuInactive := Product{
		Barcode:       "",
		Name:          "Auto SKU Inactive",
		Price:         50.0,
		Stock:         5,
		UnitOfMeasure: "und",
		Active:        false,
	}
	if err := saveOrUpdateProduct(db, skuInactive); err != nil {
		t.Fatalf("failed saving auto SKU inactive: %v", err)
	}
	var autoActive int
	var generatedBarcode string
	if err := db.QueryRow("SELECT barcode, active FROM products WHERE name = 'Auto SKU Inactive'").Scan(&generatedBarcode, &autoActive); err != nil {
		t.Fatalf("failed querying auto SKU inactive: %v", err)
	}
	if autoActive != 0 {
		t.Errorf("expected auto SKU inactive to have active == 0, got %d", autoActive)
	}
	if generatedBarcode == "" {
		t.Errorf("expected non-empty generated barcode")
	}

	// 9. Auto-generated SKU with Barcode: "" and Active: true
	skuActive := Product{
		Barcode:       "",
		Name:          "Auto SKU Active",
		Price:         60.0,
		Stock:         6,
		UnitOfMeasure: "und",
		Active:        true,
	}
	if err := saveOrUpdateProduct(db, skuActive); err != nil {
		t.Fatalf("failed saving auto SKU active: %v", err)
	}
	if err := db.QueryRow("SELECT barcode, active FROM products WHERE name = 'Auto SKU Active'").Scan(&generatedBarcode, &autoActive); err != nil {
		t.Fatalf("failed querying auto SKU active: %v", err)
	}
	if autoActive != 1 {
		t.Errorf("expected auto SKU active to have active == 1, got %d", autoActive)
	}
}

// TestChallenge_VisibilityAndQueryIsolation tests query separation across POS, Inventory, and Search.
func TestChallenge_VisibilityAndQueryIsolation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Seed 10 active products and 10 inactive products
	for i := 1; i <= 10; i++ {
		act := Product{
			Barcode:       fmt.Sprintf("ACT-%03d", i),
			Name:          fmt.Sprintf("SharedName Activo %03d", i),
			Price:         float64(i * 10),
			Stock:         i,
			UnitOfMeasure: "und",
			Location:      "Aisle-A",
			Active:        true,
		}
		if err := saveOrUpdateProduct(db, act); err != nil {
			t.Fatalf("failed seeding active %d: %v", i, err)
		}

		inact := Product{
			Barcode:       fmt.Sprintf("INACT-%03d", i),
			Name:          fmt.Sprintf("SharedName Inactivo %03d", i),
			Price:         float64(i * 10),
			Stock:         i,
			UnitOfMeasure: "und",
			Location:      "Aisle-B",
			Active:        false,
		}
		if err := saveOrUpdateProduct(db, inact); err != nil {
			t.Fatalf("failed seeding inactive %d: %v", i, err)
		}
	}

	// 1. POS active list (listAllProducts) MUST return exactly 10 products, all Active == true
	posList, err := listAllProducts(db)
	if err != nil {
		t.Fatalf("listAllProducts failed: %v", err)
	}
	if len(posList) != 10 {
		t.Fatalf("expected exactly 10 active products in POS list, got %d", len(posList))
	}
	for _, p := range posList {
		if !p.Active {
			t.Errorf("found inactive product in POS list: %+v", p)
		}
	}

	// 2. Inventory active-only (listInventoryProducts(db, false)) MUST return exactly 10 products
	invActive, err := listInventoryProducts(db, false)
	if err != nil {
		t.Fatalf("listInventoryProducts(false) failed: %v", err)
	}
	if len(invActive) != 10 {
		t.Fatalf("expected exactly 10 products in active-only inventory, got %d", len(invActive))
	}
	for _, p := range invActive {
		if !p.Active {
			t.Errorf("found inactive product in active-only inventory: %+v", p)
		}
	}

	// 3. Inventory all (listInventoryProducts(db, true)) MUST return exactly 20 products
	invAll, err := listInventoryProducts(db, true)
	if err != nil {
		t.Fatalf("listInventoryProducts(true) failed: %v", err)
	}
	if len(invAll) != 20 {
		t.Fatalf("expected exactly 20 products in all inventory, got %d", len(invAll))
	}
	actCount, inactCount := 0, 0
	for _, p := range invAll {
		if p.Active {
			actCount++
		} else {
			inactCount++
		}
	}
	if actCount != 10 || inactCount != 10 {
		t.Errorf("expected 10 active and 10 inactive in full inventory, got %d active, %d inactive", actCount, inactCount)
	}

	// 4. POS Search query isolation:
	// Searching "SharedName" matches all 20 by name, but searchProducts MUST return ONLY the 10 active ones!
	searchResults, err := searchProducts(db, "SharedName")
	if err != nil {
		t.Fatalf("searchProducts failed: %v", err)
	}
	if len(searchResults) != 10 {
		t.Errorf("expected searchProducts('SharedName') to return only the 10 active items, got %d", len(searchResults))
	}
	for _, p := range searchResults {
		if !p.Active {
			t.Errorf("searchProducts returned inactive product: %+v", p)
		}
	}

	// Searching "Inactivo" matches inactive items only -> searchProducts MUST return 0
	searchInact, err := searchProducts(db, "Inactivo")
	if err != nil {
		t.Fatalf("searchProducts('Inactivo') failed: %v", err)
	}
	if len(searchInact) != 0 {
		t.Errorf("searchProducts('Inactivo') returned %d results, expected 0", len(searchInact))
	}

	// 5. Individual lookup by barcode (getProductByBarcode):
	// Inactive item MUST be returned with Active == false
	lookupInact, err := getProductByBarcode(db, "INACT-005")
	if err != nil {
		t.Fatalf("getProductByBarcode('INACT-005') failed: %v", err)
	}
	if lookupInact.Active {
		t.Errorf("expected lookupInact.Active == false, got true")
	}

	// Active item MUST be returned with Active == true
	lookupAct, err := getProductByBarcode(db, "ACT-005")
	if err != nil {
		t.Fatalf("getProductByBarcode('ACT-005') failed: %v", err)
	}
	if !lookupAct.Active {
		t.Errorf("expected lookupAct.Active == true, got false")
	}
}

// TestChallenge_RawSQLiteIntegrity directly tests SQLite table constraints, index presence,
// and edge-case values in the active column.
func TestChallenge_RawSQLiteIntegrity(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Verify index on products(active) exists
	rows, err := db.Query("PRAGMA index_list('products')")
	if err != nil {
		t.Fatalf("failed querying index_list: %v", err)
	}
	defer rows.Close()

	hasActiveIndex := false
	for rows.Next() {
		var seq int
		var name string
		var unique int
		var origin, partial sql.NullString
		_ = rows.Scan(&seq, &name, &unique, &origin, &partial)
		if name == "idx_products_active" {
			hasActiveIndex = true
			break
		}
	}
	if !hasActiveIndex {
		t.Errorf("expected index 'idx_products_active' to exist on products table")
	}

	// 2. Insert raw active = 0 and verify scan
	_, err = db.Exec(`
		INSERT INTO products (barcode, name, price, stock, active)
		VALUES ('RAW-001', 'Raw Inactive', 10.0, 5, 0)
	`)
	if err != nil {
		t.Fatalf("raw insert active=0 failed: %v", err)
	}
	prod0, err := getProductByBarcode(db, "RAW-001")
	if err != nil || prod0.Active {
		t.Errorf("expected raw 0 to scan as Active==false, got %+v (err: %v)", prod0, err)
	}

	// 3. Insert raw active = 1 and verify scan
	_, err = db.Exec(`
		INSERT INTO products (barcode, name, price, stock, active)
		VALUES ('RAW-002', 'Raw Active', 20.0, 5, 1)
	`)
	if err != nil {
		t.Fatalf("raw insert active=1 failed: %v", err)
	}
	prod1, err := getProductByBarcode(db, "RAW-002")
	if err != nil || !prod1.Active {
		t.Errorf("expected raw 1 to scan as Active==true, got %+v (err: %v)", prod1, err)
	}

	// 4. Insert raw active = 2 (non-standard value) -> should scan as Active == false
	_, err = db.Exec(`
		INSERT INTO products (barcode, name, price, stock, active)
		VALUES ('RAW-003', 'Raw Value 2', 30.0, 5, 2)
	`)
	if err != nil {
		t.Fatalf("raw insert active=2 failed: %v", err)
	}
	prod2, err := getProductByBarcode(db, "RAW-003")
	if err != nil || prod2.Active {
		t.Errorf("expected raw 2 to scan as Active==false, got %+v", prod2)
	}

	// 5. Test NOT NULL constraint on active column
	_, err = db.Exec(`
		INSERT INTO products (barcode, name, price, stock, active)
		VALUES ('RAW-NULL', 'Raw Null Active', 40.0, 5, NULL)
	`)
	if err == nil {
		t.Errorf("expected error when inserting NULL into active column due to NOT NULL constraint")
	}
}

// TestChallenge_ConcurrentStress stresses concurrent reads, writes, and active toggles.
func TestChallenge_ConcurrentStress(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()
	db.SetMaxOpenConns(1)

	// Seed 20 initial products
	for i := 1; i <= 20; i++ {
		p := Product{
			Barcode:       fmt.Sprintf("CONC-%03d", i),
			Name:          fmt.Sprintf("Concurrent Item %03d", i),
			Price:         float64(i * 5),
			Stock:         50,
			UnitOfMeasure: "und",
			Active:        (i%2 == 0), // half active, half inactive
		}
		if err := saveOrUpdateProduct(db, p); err != nil {
			t.Fatalf("seeding failed: %v", err)
		}
	}

	numWorkers := 20
	opsPerWorker := 30
	var wg sync.WaitGroup
	var totalErrors int64

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			rng := rand.New(rand.NewSource(time.Now().UnixNano() + int64(workerID*1000)))

			for op := 0; op < opsPerWorker; op++ {
				action := rng.Intn(6)
				targetBarcode := fmt.Sprintf("CONC-%03d", rng.Intn(20)+1)

				switch action {
				case 0: // Read active POS products
					_, err := listAllProducts(db)
					if err != nil {
						atomic.AddInt64(&totalErrors, 1)
					}
				case 1: // Read inventory
					_, err := listInventoryProducts(db, rng.Intn(2) == 1)
					if err != nil {
						atomic.AddInt64(&totalErrors, 1)
					}
				case 2: // Archive
					err := archiveProduct(db, targetBarcode)
					if err != nil && err != sql.ErrNoRows {
						atomic.AddInt64(&totalErrors, 1)
					}
				case 3: // Restore
					err := restoreProduct(db, targetBarcode)
					if err != nil && err != sql.ErrNoRows {
						atomic.AddInt64(&totalErrors, 1)
					}
				case 4: // Upsert toggle
					activeFlag := (rng.Intn(2) == 1)
					err := saveOrUpdateProduct(db, Product{
						ID:            0,
						Barcode:       targetBarcode,
						Name:          fmt.Sprintf("Mutated Item %d", workerID),
						Price:         float64(rng.Intn(500) + 10),
						Stock:         rng.Intn(100),
						UnitOfMeasure: "und",
						Active:        activeFlag,
					})
					if err != nil {
						atomic.AddInt64(&totalErrors, 1)
					}
				case 5: // Search
					_, err := searchProducts(db, "Concurrent")
					if err != nil {
						atomic.AddInt64(&totalErrors, 1)
					}
				}
			}
		}(w)
	}

	wg.Wait()

	if totalErrors > 0 {
		t.Errorf("encountered %d errors during concurrent stress test", totalErrors)
	}

	// Verify consistency after concurrency:
	// Full inventory count must be at least 20
	allProds, err := listInventoryProducts(db, true)
	if err != nil {
		t.Fatalf("failed listing inventory after stress: %v", err)
	}
	if len(allProds) < 20 {
		t.Errorf("expected at least 20 products after stress test, got %d", len(allProds))
	}

	// Verify every active item in full inventory matches listAllProducts
	activeInAll := 0
	for _, p := range allProds {
		if p.Active {
			activeInAll++
		}
	}
	posAfter, err := listAllProducts(db)
	if err != nil {
		t.Fatalf("failed listing POS products after stress: %v", err)
	}
	if len(posAfter) != activeInAll {
		t.Errorf("mismatch: full inventory has %d active products, but POS list returned %d", activeInAll, len(posAfter))
	}
}

// TestChallenge_UpdateNonExistentID tests what happens when updating with an ID that doesn't exist
func TestChallenge_UpdateNonExistentID(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Update with ID: 999999 (non-existent)
	p := Product{
		ID:            999999,
		Barcode:       "GHOST-001",
		Name:          "Ghost Product",
		Price:         10.0,
		Stock:         1,
		UnitOfMeasure: "und",
		Active:        false,
	}

	err := saveOrUpdateProduct(db, p)
	// In standard db.go, UPDATE WHERE id = ? returns err (which is nil for 0 rows affected in SQLite db.Exec).
	// Let's verify whether the product was created or not:
	var count int
	_ = db.QueryRow("SELECT COUNT(*) FROM products WHERE barcode = 'GHOST-001'").Scan(&count)
	if count > 0 {
		t.Errorf("ghost product was unexpectedly created when ID was non-existent")
	}
	// Note: err may be nil because SQLite UPDATE with 0 matching rows is not an SQL error.
	_ = err
}
