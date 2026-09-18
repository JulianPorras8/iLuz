package main

import (
	"database/sql"
	"fmt"
	"math/rand"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestEmpirical_WALPersistence verifies data durability across database close and reopen under WAL mode.
func TestEmpirical_WALPersistence(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "wal_persistence.db")

	// Phase 1: Open DB, configure WAL, insert dataset
	db1 := initDB(dbPath)

	// Verify PRAGMA journal_mode is indeed WAL
	var journalMode string
	err := db1.QueryRow("PRAGMA journal_mode;").Scan(&journalMode)
	if err != nil {
		t.Fatalf("failed checking journal_mode: %v", err)
	}
	if journalMode != "wal" {
		t.Fatalf("expected journal_mode 'wal', got '%s'", journalMode)
	}

	testProducts := []Product{
		{Barcode: "WAL-001", Name: "Product Alpha", Price: 100.0, Stock: 10, Active: true},
		{Barcode: "WAL-002", Name: "Product Beta", Price: 200.0, Stock: 0, Active: false},
		{Barcode: "WAL-003", Name: "Product Gamma", Price: 300.0, Stock: 5, Active: true},
		{Barcode: "", Name: "Product Manual Inactive", Price: 50.0, Stock: 2, Active: false},
	}

	for _, p := range testProducts {
		if err := saveOrUpdateProduct(db1, p); err != nil {
			t.Fatalf("failed inserting product %s: %v", p.Barcode, err)
		}
	}

	// Archive WAL-001
	if err := archiveProduct(db1, "WAL-001"); err != nil {
		t.Fatalf("failed archiving WAL-001: %v", err)
	}

	// Close DB connection abruptly without manual PRAGMA wal_checkpoint
	db1.Close()

	// Phase 2: Reopen DB and verify persistence
	db2 := initDB(dbPath)
	defer db2.Close()

	// Verify WAL-001 is archived (Active == false)
	p1, err := getProductByBarcode(db2, "WAL-001")
	if err != nil {
		t.Fatalf("failed retrieving WAL-001 after reopen: %v", err)
	}
	if p1.Active {
		t.Errorf("expected WAL-001 to remain inactive after reopen, got Active=true")
	}

	// Verify WAL-002 is inactive
	p2, err := getProductByBarcode(db2, "WAL-002")
	if err != nil {
		t.Fatalf("failed retrieving WAL-002 after reopen: %v", err)
	}
	if p2.Active {
		t.Errorf("expected WAL-002 to remain inactive after reopen, got Active=true")
	}

	// Verify WAL-003 is active
	p3, err := getProductByBarcode(db2, "WAL-003")
	if err != nil {
		t.Fatalf("failed retrieving WAL-003 after reopen: %v", err)
	}
	if !p3.Active {
		t.Errorf("expected WAL-003 to remain active after reopen, got Active=false")
	}

	// Verify listInventoryProducts(db2, true) returns 4 items
	allInv, err := listInventoryProducts(db2, true)
	if err != nil {
		t.Fatalf("failed listing inventory: %v", err)
	}
	if len(allInv) != 4 {
		t.Fatalf("expected 4 total products, got %d", len(allInv))
	}

	// Verify listAllProducts (POS active list) returns only WAL-003
	activePos, err := listAllProducts(db2)
	if err != nil {
		t.Fatalf("failed listing active POS products: %v", err)
	}
	if len(activePos) != 1 || activePos[0].Barcode != "WAL-003" {
		t.Fatalf("expected exactly 1 active product (WAL-003), got %d (%+v)", len(activePos), activePos)
	}
}

// TestEmpirical_ArchiveAndRestoreConsistency verifies error contracts and idempotency.
func TestEmpirical_ArchiveAndRestoreConsistency(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Seed product
	prod := Product{
		Barcode: "CONSIST-001",
		Name:    "Consistency Test Item",
		Price:   99.99,
		Stock:   15,
		Active:  true,
	}
	if err := saveOrUpdateProduct(db, prod); err != nil {
		t.Fatalf("failed saving test product: %v", err)
	}

	// 1. Non-existent items must return sql.ErrNoRows
	nonExistentCodes := []string{
		"NON-EXISTENT-XYZ",
		"1234567899999999",
		"   ",
		"",
		"' OR '1'='1",
		"'; DROP TABLE products; --",
	}
	for _, code := range nonExistentCodes {
		if err := archiveProduct(db, code); err != sql.ErrNoRows {
			t.Errorf("archiveProduct(%q): expected sql.ErrNoRows, got %v", code, err)
		}
		if err := restoreProduct(db, code); err != sql.ErrNoRows {
			t.Errorf("restoreProduct(%q): expected sql.ErrNoRows, got %v", code, err)
		}
	}

	// Verify SQL injection attempt didn't drop products table
	var tableCount int
	err := db.QueryRow("SELECT COUNT(*) FROM products").Scan(&tableCount)
	if err != nil || tableCount != 1 {
		t.Fatalf("SQL injection vulnerability detected or table corrupt! count: %d, err: %v", tableCount, err)
	}

	// 2. Archive and restore transitions with whitespace tolerance
	if err := archiveProduct(db, "  CONSIST-001  "); err != nil {
		t.Fatalf("archive with whitespace failed: %v", err)
	}
	p, _ := getProductByBarcode(db, "CONSIST-001")
	if p.Active {
		t.Errorf("expected product to be inactive after archive")
	}

	// 3. Repeated archive on already archived item is idempotent (returns nil)
	for i := 0; i < 5; i++ {
		if err := archiveProduct(db, "CONSIST-001"); err != nil {
			t.Errorf("idempotent archive #%d failed: %v", i+1, err)
		}
	}

	// 4. Restore
	if err := restoreProduct(db, "\nCONSIST-001\t"); err != nil {
		t.Fatalf("restore with whitespace failed: %v", err)
	}
	p, _ = getProductByBarcode(db, "CONSIST-001")
	if !p.Active {
		t.Errorf("expected product to be active after restore")
	}

	// 5. Repeated restore on already active item is idempotent (returns nil)
	for i := 0; i < 5; i++ {
		if err := restoreProduct(db, "CONSIST-001"); err != nil {
			t.Errorf("idempotent restore #%d failed: %v", i+1, err)
		}
	}
}

// TestEmpirical_SQLiteThreadSafety_DesktopModel tests high concurrency under the desktop POS model.
func TestEmpirical_SQLiteThreadSafety_DesktopModel(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "wal_desktop_concurrency.db")
	db := initDB(dbPath)
	defer db.Close()

	// Apply desktop POS single-writer serialization pattern
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	const numBaseProducts = 20
	for i := 1; i <= numBaseProducts; i++ {
		p := Product{
			Barcode:  fmt.Sprintf("CONCUR-%03d", i),
			Name:     fmt.Sprintf("Concurrent Item %03d", i),
			Price:    float64(i * 10),
			Stock:    100,
			Location: fmt.Sprintf("Loc-%d", i%5),
			Active:   i%2 == 0,
		}
		if err := saveOrUpdateProduct(db, p); err != nil {
			t.Fatalf("failed seeding product %d: %v", i, err)
		}
	}

	const numWorkers = 20
	const opsPerWorker = 50
	var wg sync.WaitGroup
	var busyLockErrors int64
	var otherErrors int64
	var successOps int64

	startSignal := make(chan struct{})

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		workerID := w
		go func() {
			defer wg.Done()
			<-startSignal

			r := rand.New(rand.NewSource(time.Now().UnixNano() + int64(workerID)))

			for op := 0; op < opsPerWorker; op++ {
				action := r.Intn(5)
				targetBarcode := fmt.Sprintf("CONCUR-%03d", r.Intn(numBaseProducts)+1)
				var err error

				switch action {
				case 0: // Read active products or search
					if r.Intn(2) == 0 {
						_, err = listAllProducts(db)
					} else {
						_, err = searchProducts(db, "Concurrent")
					}
				case 1: // Read specific product
					_, err = getProductByBarcode(db, targetBarcode)
				case 2: // Archive or restore
					if r.Intn(2) == 0 {
						err = archiveProduct(db, targetBarcode)
					} else {
						err = restoreProduct(db, targetBarcode)
					}
				case 3: // Update product location
					newLoc := fmt.Sprintf("Loc-Worker-%d-Op-%d", workerID, op)
					err = updateProductLocation(db, targetBarcode, newLoc)
				case 4: // Conflict upsert with Active flag mutation
					newActive := (r.Intn(2) == 1)
					p := Product{
						Barcode:  targetBarcode,
						Name:     fmt.Sprintf("Item %s (Updated by %d)", targetBarcode, workerID),
						Price:    float64(r.Intn(500) + 10),
						Stock:    r.Intn(50),
						Location: fmt.Sprintf("Rack-%d", r.Intn(10)),
						Active:   newActive,
					}
					err = saveOrUpdateProduct(db, p)
				}

				if err != nil {
					if isBusyOrLockError(err) {
						atomic.AddInt64(&busyLockErrors, 1)
					} else {
						atomic.AddInt64(&otherErrors, 1)
					}
				} else {
					atomic.AddInt64(&successOps, 1)
				}
			}
		}()
	}

	close(startSignal)
	wg.Wait()

	t.Logf("Desktop POS Concurrency Stress Test: success=%d, busyLockErrors=%d, otherErrors=%d",
		atomic.LoadInt64(&successOps),
		atomic.LoadInt64(&busyLockErrors),
		atomic.LoadInt64(&otherErrors),
	)

	if atomic.LoadInt64(&busyLockErrors) > 0 {
		t.Fatalf("FAILED: Encountered %d SQLite BUSY errors under desktop POS model", busyLockErrors)
	}
	if atomic.LoadInt64(&otherErrors) > 0 {
		t.Fatalf("FAILED: Encountered %d unexpected errors during execution", otherErrors)
	}

	// Verify post-test integrity of all products
	allFinal, err := listInventoryProducts(db, true)
	if err != nil {
		t.Fatalf("failed listing final inventory: %v", err)
	}
	if len(allFinal) != numBaseProducts {
		t.Fatalf("expected %d products after stress test, got %d", numBaseProducts, len(allFinal))
	}
	for _, p := range allFinal {
		var rawActive int
		_ = db.QueryRow("SELECT active FROM products WHERE barcode = ?", p.Barcode).Scan(&rawActive)
		if (rawActive == 1) != p.Active {
			t.Errorf("Final state corruption for %s: p.Active=%v, rawActive=%d", p.Barcode, p.Active, rawActive)
		}
	}
}

// TestEmpirical_SQLiteThreadSafety_ConnectionPoolAnalysis documents multi-connection pool behavior and the DSN fix.
func TestEmpirical_SQLiteThreadSafety_ConnectionPoolAnalysis(t *testing.T) {
	tmpDir := t.TempDir()

	// Scenario A: Vanilla initDB with default unconstrained pool
	// Demonstrates that PRAGMA busy_timeout is connection-scoped and not inherited by newly opened pool connections.
	dbVanilla := initDB(filepath.Join(tmpDir, "vanilla_pool.db"))
	defer dbVanilla.Close()

	var busyVanilla int64
	var wgA sync.WaitGroup
	for i := 0; i < 10; i++ {
		wgA.Add(1)
		go func(w int) {
			defer wgA.Done()
			for j := 0; j < 20; j++ {
				p := Product{Barcode: fmt.Sprintf("VAN-%d-%d", w, j), Name: "Test", Active: true}
				if err := saveOrUpdateProduct(dbVanilla, p); err != nil && isBusyOrLockError(err) {
					atomic.AddInt64(&busyVanilla, 1)
				}
			}
		}(i)
	}
	wgA.Wait()
	t.Logf("Empirical Finding: Vanilla initDB multi-connection pool encountered %d SQLITE_BUSY errors", busyVanilla)

	// Scenario B: DSN configured with _pragma=busy_timeout(5000)
	// Demonstrates that configuring busy_timeout at the driver DSN level eliminates BUSY errors across all connections.
	dsn := fmt.Sprintf("%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)", filepath.Join(tmpDir, "dsn_hardened.db"))
	dbDSN, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("failed opening hardened DSN: %v", err)
	}
	defer dbDSN.Close()

	_, err = dbDSN.Exec(`CREATE TABLE IF NOT EXISTS products (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		barcode TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		price REAL NOT NULL DEFAULT 0.0,
		stock INTEGER NOT NULL DEFAULT 0,
		weight REAL NOT NULL DEFAULT 0.0,
		size TEXT NOT NULL DEFAULT '',
		unit_of_measure TEXT NOT NULL DEFAULT 'und',
		color TEXT NOT NULL DEFAULT '',
		location TEXT NOT NULL DEFAULT '',
		active INTEGER NOT NULL DEFAULT 1
	);`)
	if err != nil {
		t.Fatalf("failed initializing schema on dbDSN: %v", err)
	}

	var busyDSN int64
	var wgB sync.WaitGroup
	for i := 0; i < 10; i++ {
		wgB.Add(1)
		go func(w int) {
			defer wgB.Done()
			for j := 0; j < 20; j++ {
				p := Product{Barcode: fmt.Sprintf("DSN-%d-%d", w, j), Name: "Test", Active: true}
				if err := saveOrUpdateProduct(dbDSN, p); err != nil && isBusyOrLockError(err) {
					atomic.AddInt64(&busyDSN, 1)
				}
			}
		}(i)
	}
	wgB.Wait()
	t.Logf("Empirical Finding: DSN _pragma=busy_timeout(5000) encountered %d SQLITE_BUSY errors (100%% resolved)", busyDSN)

	if busyDSN != 0 {
		t.Errorf("expected 0 busy errors with DSN busy_timeout, got %d", busyDSN)
	}
}

func isBusyOrLockError(err error) bool {
	if err == nil {
		return false
	}
	str := err.Error()
	return containsAny(str, "database is locked", "busy", "SQLITE_BUSY", "cannot start a transaction within a transaction")
}

func containsAny(s string, substrings ...string) bool {
	for _, sub := range substrings {
		if len(s) >= len(sub) && (s == sub || hasSubstr(s, sub)) {
			return true
		}
	}
	return false
}

func hasSubstr(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
