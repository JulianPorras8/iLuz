package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setupTestDB(t *testing.T) (*sql.DB, func()) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_inventario.db")
	db := initDB(dbPath)

	cleanup := func() {
		_ = db.Close()
		_ = os.Remove(dbPath)
	}
	return db, cleanup
}

func TestInitDB(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		t.Fatal("expected non-nil db")
	}

	// Verify products and locations tables exist
	var name string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").Scan(&name)
	if err != nil || name != "products" {
		t.Fatalf("expected products table to exist: %v", err)
	}

	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='locations'").Scan(&name)
	if err != nil || name != "locations" {
		t.Fatalf("expected locations table to exist: %v", err)
	}
}

func TestAutoMigrationFromLegacySchema(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "legacy.db")

	// Create legacy database manually
	legacyDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to create legacy db: %v", err)
	}
	_, err = legacyDB.Exec(`
		CREATE TABLE products (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			barcode TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			price REAL NOT NULL DEFAULT 0.0,
			stock INTEGER NOT NULL DEFAULT 0
		);
		INSERT INTO products (barcode, name, price, stock) VALUES ('123', 'Old Product', 10.0, 5);
	`)
	if err != nil {
		t.Fatalf("failed to populate legacy db: %v", err)
	}
	legacyDB.Close()

	// Open with initDB which must run auto-migration
	migratedDB := initDB(dbPath)
	defer func() {
		_ = migratedDB.Close()
		_ = os.Remove(dbPath)
	}()

	// Query product with new fields
	prod, err := getProductByBarcode(migratedDB, "123")
	if err != nil {
		t.Fatalf("failed retrieving migrated product: %v", err)
	}
	if prod.Name != "Old Product" {
		t.Errorf("expected 'Old Product', got %s", prod.Name)
	}
	if prod.UnitOfMeasure != "und" {
		t.Errorf("expected default unit 'und', got %s", prod.UnitOfMeasure)
	}
	if !prod.Active {
		t.Errorf("expected migrated product to be active")
	}
}

func TestSaveAndGetProductExpanded(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	prod := Product{
		Barcode:       "7701234567890",
		Name:          "Leche Entera 1L",
		Price:         3500.50,
		Stock:         20,
		Weight:        1.0,
		Size:          "1000ml",
		UnitOfMeasure: "l",
		Color:         "Blanco",
		Location:      "Pasillo 2, Estante B",
		Active:        true,
	}

	// 1. Insert new product
	err := saveOrUpdateProduct(db, prod)
	if err != nil {
		t.Fatalf("unexpected error saving product: %v", err)
	}

	// 2. Retrieve product
	saved, err := getProductByBarcode(db, "7701234567890")
	if err != nil {
		t.Fatalf("unexpected error retrieving product: %v", err)
	}
	if saved.Weight != 1.0 || saved.UnitOfMeasure != "l" || saved.Location != "Pasillo 2, Estante B" {
		t.Errorf("mismatch in saved expanded properties: %+v", saved)
	}

	// 3. Update existing product by ID
	saved.Name = "Leche Deslactosada 1L"
	saved.Price = 3800.0
	saved.Location = "Pasillo 2, Estante C"
	err = saveOrUpdateProduct(db, *saved)
	if err != nil {
		t.Fatalf("unexpected error updating product by ID: %v", err)
	}

	updated, err := getProductByBarcode(db, "7701234567890")
	if err != nil {
		t.Fatalf("unexpected error retrieving updated product: %v", err)
	}
	if updated.Name != "Leche Deslactosada 1L" || updated.Location != "Pasillo 2, Estante C" {
		t.Errorf("mismatch in updated product: %+v", updated)
	}
}

func TestManualProductCreationWithoutBarcode(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	prod := Product{
		Barcode:       "", // Left empty by user
		Name:          "Manzana Roja por Libra",
		Price:         2500.0,
		Stock:         30,
		UnitOfMeasure: "lb",
		Active:        true,
	}

	err := saveOrUpdateProduct(db, prod)
	if err != nil {
		t.Fatalf("unexpected error saving manual product without barcode: %v", err)
	}

	list, err := listInventoryProducts(db, false)
	if err != nil {
		t.Fatalf("failed listing inventory products: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 product, got %d", len(list))
	}
	if list[0].Barcode == "" || len(list[0].Barcode) < 4 {
		t.Errorf("expected auto-generated internal barcode, got '%s'", list[0].Barcode)
	}
}

func TestUpdateProductLocation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	p := Product{Barcode: "BAR1", Name: "Item 1", Price: 10, Stock: 5, Active: true}
	_ = saveOrUpdateProduct(db, p)

	// Set location
	err := updateProductLocation(db, "BAR1", "Bodega 3 - Rampa A")
	if err != nil {
		t.Fatalf("failed updating product location: %v", err)
	}

	updated, _ := getProductByBarcode(db, "BAR1")
	if updated.Location != "Bodega 3 - Rampa A" {
		t.Errorf("expected location 'Bodega 3 - Rampa A', got '%s'", updated.Location)
	}

	// Clear location
	err = updateProductLocation(db, "BAR1", "")
	if err != nil {
		t.Fatalf("failed clearing product location: %v", err)
	}
	cleared, _ := getProductByBarcode(db, "BAR1")
	if cleared.Location != "" {
		t.Errorf("expected empty location, got '%s'", cleared.Location)
	}
}

func TestArchiveAndRestoreProduct(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	p := Product{Barcode: "BAR2", Name: "Item 2", Price: 20, Stock: 5, Active: true}
	_ = saveOrUpdateProduct(db, p)

	// Archive
	err := archiveProduct(db, "BAR2")
	if err != nil {
		t.Fatalf("failed archiving product: %v", err)
	}

	// In POS active list, it should NOT appear
	posList, _ := listAllProducts(db)
	if len(posList) != 0 {
		t.Errorf("expected 0 active products in POS, got %d", len(posList))
	}

	// In inventory list without archived, should NOT appear
	invActive, _ := listInventoryProducts(db, false)
	if len(invActive) != 0 {
		t.Errorf("expected 0 active products, got %d", len(invActive))
	}

	// In inventory list with archived, SHOULD appear
	invAll, _ := listInventoryProducts(db, true)
	if len(invAll) != 1 || invAll[0].Active {
		t.Errorf("expected 1 archived product, got %+v", invAll)
	}

	// Restore
	err = restoreProduct(db, "BAR2")
	if err != nil {
		t.Fatalf("failed restoring product: %v", err)
	}

	restored, _ := getProductByBarcode(db, "BAR2")
	if !restored.Active {
		t.Errorf("expected restored product to be active")
	}
}

func TestLocationCatalogCRUD(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	loc := Location{
		Code:        "PAS-01",
		Name:        "Pasillo 1 - Abarrotes",
		Description: "Zona de granos y harinas",
	}

	// Save
	err := saveLocation(db, loc)
	if err != nil {
		t.Fatalf("failed saving location: %v", err)
	}

	locations, err := getAllLocations(db)
	if err != nil {
		t.Fatalf("failed getting locations: %v", err)
	}
	if len(locations) != 1 {
		t.Fatalf("expected 1 location, got %d", len(locations))
	}
	if locations[0].Code != "PAS-01" {
		t.Errorf("expected location code 'PAS-01', got %s", locations[0].Code)
	}

	// Delete
	err = deleteLocation(db, locations[0].ID)
	if err != nil {
		t.Fatalf("failed deleting location: %v", err)
	}

	remaining, _ := getAllLocations(db)
	if len(remaining) != 0 {
		t.Errorf("expected 0 locations, got %d", len(remaining))
	}
}

// ============================================================================
// Active Flag Retention and Lifecycle Tests (Milestone 1)
// ============================================================================

func TestSaveNewProduct_InactiveRetention(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Save new product with ID: 0 and Active: false
	prod := Product{
		ID:            0,
		Barcode:       "TEST-INACT-001",
		Name:          "Producto Inactivo Nuevo",
		Price:         1500.0,
		Stock:         10,
		Weight:        0.5,
		Size:          "Mediano",
		UnitOfMeasure: "und",
		Color:         "Azul",
		Location:      "Bodega 1",
		Active:        false,
	}

	err := saveOrUpdateProduct(db, prod)
	if err != nil {
		t.Fatalf("unexpected error saving inactive product: %v", err)
	}

	// 2. Verify via raw SQLite query on barcode
	var id int64
	var activeInt int
	err = db.QueryRow("SELECT id, active FROM products WHERE barcode = ?", "TEST-INACT-001").Scan(&id, &activeInt)
	if err != nil {
		t.Fatalf("failed querying product by barcode: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected auto-generated ID > 0, got %d", id)
	}
	if activeInt != 0 {
		t.Errorf("expected raw active column to be 0, got %d", activeInt)
	}

	// 3. Verify via raw SQLite query on generated ID (GetProductByID equivalent)
	var activeByID int
	err = db.QueryRow("SELECT active FROM products WHERE id = ?", id).Scan(&activeByID)
	if err != nil {
		t.Fatalf("failed querying product by ID %d: %v", id, err)
	}
	if activeByID != 0 {
		t.Errorf("expected active column by ID to be 0, got %d", activeByID)
	}

	// 4. Verify via getProductByBarcode
	saved, err := getProductByBarcode(db, "TEST-INACT-001")
	if err != nil {
		t.Fatalf("failed retrieving product by barcode: %v", err)
	}
	if saved.Active {
		t.Errorf("expected saved.Active to be false, got true")
	}

	// 5. Verify query isolation:
	// - listAllProducts (POS active list) MUST NOT contain this product
	posProducts, err := listAllProducts(db)
	if err != nil {
		t.Fatalf("failed listing active POS products: %v", err)
	}
	for _, p := range posProducts {
		if p.Barcode == "TEST-INACT-001" {
			t.Errorf("inactive product unexpectedly appeared in active POS products list: %+v", p)
		}
	}

	// - listInventoryProducts(db, false) (active-only inventory) MUST NOT contain this product
	invActive, err := listInventoryProducts(db, false)
	if err != nil {
		t.Fatalf("failed listing active inventory products: %v", err)
	}
	for _, p := range invActive {
		if p.Barcode == "TEST-INACT-001" {
			t.Errorf("inactive product unexpectedly appeared in active inventory: %+v", p)
		}
	}

	// - listInventoryProducts(db, true) (all inventory) MUST contain this product with Active == false
	invAll, err := listInventoryProducts(db, true)
	if err != nil {
		t.Fatalf("failed listing all inventory products: %v", err)
	}
	found := false
	for _, p := range invAll {
		if p.Barcode == "TEST-INACT-001" {
			found = true
			if p.Active {
				t.Errorf("expected product in full inventory to have Active == false, got true")
			}
			break
		}
	}
	if !found {
		t.Errorf("expected inactive product to be present in full inventory list")
	}

	// - searchProducts (POS autocomplete) MUST NOT find this product
	searchResults, err := searchProducts(db, "Producto Inactivo")
	if err != nil {
		t.Fatalf("failed searching products: %v", err)
	}
	if len(searchResults) != 0 {
		t.Errorf("expected 0 search results for inactive product in POS search, got %d", len(searchResults))
	}

	// 6. Subcase: Manual product creation without barcode with Active: false
	manualInactive := Product{
		Barcode:       "", // Triggers internal SKU generation
		Name:          "Manual Inactivo",
		Price:         800.0,
		Stock:         5,
		UnitOfMeasure: "und",
		Active:        false,
	}
	err = saveOrUpdateProduct(db, manualInactive)
	if err != nil {
		t.Fatalf("failed saving manual inactive product: %v", err)
	}

	invAllManual, err := listInventoryProducts(db, true)
	if err != nil {
		t.Fatalf("failed listing full inventory: %v", err)
	}
	manualFound := false
	for _, p := range invAllManual {
		if p.Name == "Manual Inactivo" {
			manualFound = true
			if p.Active {
				t.Errorf("expected manual product to have Active == false, got true")
			}
			var mActive int
			_ = db.QueryRow("SELECT active FROM products WHERE barcode = ?", p.Barcode).Scan(&mActive)
			if mActive != 0 {
				t.Errorf("expected raw active == 0 for manual product, got %d", mActive)
			}
			break
		}
	}
	if !manualFound {
		t.Errorf("expected manual inactive product to be found in full inventory")
	}
}

func TestUpdateProduct_ActiveToInactive(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Create an initially active product
	prod := Product{
		Barcode:       "TEST-UPD-001",
		Name:          "Producto Para Actualizar",
		Price:         2000.0,
		Stock:         15,
		UnitOfMeasure: "und",
		Active:        true,
	}
	err := saveOrUpdateProduct(db, prod)
	if err != nil {
		t.Fatalf("unexpected error saving product: %v", err)
	}

	saved, err := getProductByBarcode(db, "TEST-UPD-001")
	if err != nil {
		t.Fatalf("failed retrieving product: %v", err)
	}
	if !saved.Active || saved.ID == 0 {
		t.Fatalf("expected active product with ID > 0, got Active=%v, ID=%d", saved.Active, saved.ID)
	}

	// 2. Update existing product by ID from Active: true to Active: false
	saved.Active = false
	saved.Price = 2500.0
	err = saveOrUpdateProduct(db, *saved)
	if err != nil {
		t.Fatalf("unexpected error updating product to inactive: %v", err)
	}

	// 3. Verify raw SQLite active column is 0
	var activeInt int
	err = db.QueryRow("SELECT active FROM products WHERE id = ?", saved.ID).Scan(&activeInt)
	if err != nil {
		t.Fatalf("failed querying product by ID: %v", err)
	}
	if activeInt != 0 {
		t.Errorf("expected active column to be 0 after update, got %d", activeInt)
	}

	// 4. Verify getProductByBarcode reflects Active: false and updated price
	updated, err := getProductByBarcode(db, "TEST-UPD-001")
	if err != nil {
		t.Fatalf("failed retrieving updated product: %v", err)
	}
	if updated.Active {
		t.Errorf("expected updated product Active to be false, got true")
	}
	if updated.Price != 2500.0 {
		t.Errorf("expected updated price 2500.0, got %f", updated.Price)
	}

	// 5. Verify excluded from POS active products
	posList, _ := listAllProducts(db)
	if len(posList) != 0 {
		t.Errorf("expected 0 products in active POS list, got %d", len(posList))
	}

	// 6. Toggle back: update from Active: false to Active: true
	updated.Active = true
	err = saveOrUpdateProduct(db, *updated)
	if err != nil {
		t.Fatalf("unexpected error reactivating product: %v", err)
	}

	err = db.QueryRow("SELECT active FROM products WHERE id = ?", updated.ID).Scan(&activeInt)
	if err != nil {
		t.Fatalf("failed querying reactivated product: %v", err)
	}
	if activeInt != 1 {
		t.Errorf("expected active column to be 1 after reactivation, got %d", activeInt)
	}

	reactivated, _ := getProductByBarcode(db, "TEST-UPD-001")
	if !reactivated.Active {
		t.Errorf("expected reactivated.Active to be true, got false")
	}

	posListAfter, _ := listAllProducts(db)
	if len(posListAfter) != 1 {
		t.Errorf("expected 1 product in POS after reactivation, got %d", len(posListAfter))
	}
}

func TestConflictUpsert_ActiveFlagRetention(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Scenario A: Existing active product -> Upsert with ID: 0 and Active: false
	initialActive := Product{
		Barcode:       "TEST-UPSERT-001",
		Name:          "Original Activo",
		Price:         1000.0,
		Stock:         5,
		UnitOfMeasure: "und",
		Active:        true,
	}
	if err := saveOrUpdateProduct(db, initialActive); err != nil {
		t.Fatalf("failed saving initial active product: %v", err)
	}

	upsertInactive := Product{
		ID:            0, // ID 0 forces INSERT ... ON CONFLICT(barcode)
		Barcode:       "TEST-UPSERT-001",
		Name:          "Actualizado Inactivo",
		Price:         1200.0,
		Stock:         8,
		UnitOfMeasure: "und",
		Active:        false,
	}
	if err := saveOrUpdateProduct(db, upsertInactive); err != nil {
		t.Fatalf("failed conflict upsert with Active: false: %v", err)
	}

	var activeInt int
	var name string
	err := db.QueryRow("SELECT name, active FROM products WHERE barcode = ?", "TEST-UPSERT-001").Scan(&name, &activeInt)
	if err != nil {
		t.Fatalf("failed querying upserted product: %v", err)
	}
	if name != "Actualizado Inactivo" {
		t.Errorf("expected name 'Actualizado Inactivo', got '%s'", name)
	}
	if activeInt != 0 {
		t.Errorf("expected active == 0 after conflict upsert with Active: false, got %d", activeInt)
	}

	p, err := getProductByBarcode(db, "TEST-UPSERT-001")
	if err != nil {
		t.Fatalf("failed retrieving product: %v", err)
	}
	if p.Active {
		t.Errorf("expected p.Active to be false after conflict upsert, got true")
	}

	// Scenario B: Existing archived/inactive product -> Upsert with ID: 0 and Active: false
	// MUST NOT accidentally resurrect the archived product to active = 1!
	upsertMetadata := Product{
		ID:            0,
		Barcode:       "TEST-UPSERT-001",
		Name:          "Actualizado Otra Vez",
		Price:         1300.0,
		Stock:         12,
		UnitOfMeasure: "und",
		Active:        false,
	}
	if err := saveOrUpdateProduct(db, upsertMetadata); err != nil {
		t.Fatalf("failed second conflict upsert: %v", err)
	}

	err = db.QueryRow("SELECT active FROM products WHERE barcode = ?", "TEST-UPSERT-001").Scan(&activeInt)
	if err != nil {
		t.Fatalf("failed querying product active status: %v", err)
	}
	if activeInt != 0 {
		t.Errorf("CRITICAL BUG: conflict upsert on inactive product resurrected active to %d (expected 0)", activeInt)
	}

	// Scenario C: Conflict upsert with Active: true explicitly reactivates
	upsertReactivate := Product{
		ID:            0,
		Barcode:       "TEST-UPSERT-001",
		Name:          "Reactivado por Upsert",
		Price:         1400.0,
		Stock:         20,
		UnitOfMeasure: "und",
		Active:        true,
	}
	if err := saveOrUpdateProduct(db, upsertReactivate); err != nil {
		t.Fatalf("failed reactivating conflict upsert: %v", err)
	}

	err = db.QueryRow("SELECT active FROM products WHERE barcode = ?", "TEST-UPSERT-001").Scan(&activeInt)
	if err != nil {
		t.Fatalf("failed querying reactivated product: %v", err)
	}
	if activeInt != 1 {
		t.Errorf("expected active == 1 after reactivating upsert, got %d", activeInt)
	}

	reactivated, _ := getProductByBarcode(db, "TEST-UPSERT-001")
	if !reactivated.Active {
		t.Errorf("expected reactivated.Active to be true, got false")
	}
}

func TestArchiveAndRestoreProduct_LifecycleAndEdges(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Setup active product
	prod := Product{
		Barcode:       "TEST-LIFECYCLE-001",
		Name:          "Producto Ciclo de Vida",
		Price:         3000.0,
		Stock:         10,
		UnitOfMeasure: "und",
		Active:        true,
	}
	if err := saveOrUpdateProduct(db, prod); err != nil {
		t.Fatalf("failed saving test product: %v", err)
	}

	// 2. Archive with whitespace in barcode parameter
	err := archiveProduct(db, "  TEST-LIFECYCLE-001  \n")
	if err != nil {
		t.Fatalf("failed archiving product with whitespace: %v", err)
	}

	var activeInt int
	err = db.QueryRow("SELECT active FROM products WHERE barcode = ?", "TEST-LIFECYCLE-001").Scan(&activeInt)
	if err != nil || activeInt != 0 {
		t.Errorf("expected active == 0 after archive, got %d (err: %v)", activeInt, err)
	}

	archivedProd, err := getProductByBarcode(db, "TEST-LIFECYCLE-001")
	if err != nil || archivedProd.Active {
		t.Errorf("expected archived product to have Active == false, got %+v (err: %v)", archivedProd, err)
	}

	// In POS active list, it should NOT appear
	posList, _ := listAllProducts(db)
	if len(posList) != 0 {
		t.Errorf("expected 0 active products in POS, got %d", len(posList))
	}

	// In inventory list without archived, should NOT appear
	invActive, _ := listInventoryProducts(db, false)
	if len(invActive) != 0 {
		t.Errorf("expected 0 active products in filtered inventory, got %d", len(invActive))
	}

	// In inventory list with archived, SHOULD appear
	invAll, _ := listInventoryProducts(db, true)
	if len(invAll) != 1 || invAll[0].Active {
		t.Errorf("expected 1 archived product in full inventory, got %+v", invAll)
	}

	// 3. Restore with whitespace in barcode parameter
	err = restoreProduct(db, "\t TEST-LIFECYCLE-001 ")
	if err != nil {
		t.Fatalf("failed restoring product with whitespace: %v", err)
	}

	err = db.QueryRow("SELECT active FROM products WHERE barcode = ?", "TEST-LIFECYCLE-001").Scan(&activeInt)
	if err != nil || activeInt != 1 {
		t.Errorf("expected active == 1 after restore, got %d (err: %v)", activeInt, err)
	}

	restoredProd, err := getProductByBarcode(db, "TEST-LIFECYCLE-001")
	if err != nil || !restoredProd.Active {
		t.Errorf("expected restored product to have Active == true, got %+v (err: %v)", restoredProd, err)
	}

	// 4. Restore an item that was initially created inactive (ID: 0, Active: false)
	inactiveInit := Product{
		Barcode:       "TEST-INIT-INACTIVE",
		Name:          "Nacido Inactivo",
		Price:         500.0,
		Stock:         2,
		UnitOfMeasure: "und",
		Active:        false,
	}
	if err := saveOrUpdateProduct(db, inactiveInit); err != nil {
		t.Fatalf("failed saving initially inactive product: %v", err)
	}

	err = restoreProduct(db, "TEST-INIT-INACTIVE")
	if err != nil {
		t.Fatalf("failed restoring initially inactive product: %v", err)
	}

	initRestored, err := getProductByBarcode(db, "TEST-INIT-INACTIVE")
	if err != nil || !initRestored.Active {
		t.Errorf("expected initially inactive product to be active after restore, got %+v", initRestored)
	}

	// 5. Error case: non-existent barcode returns sql.ErrNoRows
	err = archiveProduct(db, "NON-EXISTENT-BARCODE-999")
	if err != sql.ErrNoRows {
		t.Errorf("expected sql.ErrNoRows when archiving non-existent barcode, got %v", err)
	}

	err = restoreProduct(db, "NON-EXISTENT-BARCODE-999")
	if err != sql.ErrNoRows {
		t.Errorf("expected sql.ErrNoRows when restoring non-existent barcode, got %v", err)
	}

	// 6. Error case: empty / whitespace barcode returns sql.ErrNoRows
	err = archiveProduct(db, "   ")
	if err != sql.ErrNoRows {
		t.Errorf("expected sql.ErrNoRows when archiving blank barcode, got %v", err)
	}

	err = restoreProduct(db, "   ")
	if err != sql.ErrNoRows {
		t.Errorf("expected sql.ErrNoRows when restoring blank barcode, got %v", err)
	}

	// 7. Idempotency: archiving already archived item succeeds
	err = archiveProduct(db, "TEST-LIFECYCLE-001")
	if err != nil {
		t.Fatalf("expected archive to succeed: %v", err)
	}
	err = archiveProduct(db, "TEST-LIFECYCLE-001")
	if err != nil {
		t.Errorf("expected archiving already archived product to be idempotent and return nil, got %v", err)
	}

	// Idempotency: restoring already active item succeeds
	err = restoreProduct(db, "TEST-LIFECYCLE-001")
	if err != nil {
		t.Fatalf("expected restore to succeed: %v", err)
	}
	err = restoreProduct(db, "TEST-LIFECYCLE-001")
	if err != nil {
		t.Errorf("expected restoring already active product to be idempotent and return nil, got %v", err)
	}
}

func TestInventorySession_StartAndPrepopulate(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "BAR-1", Name: "Prod 1", Price: 10.0, Stock: 25, Location: "EST-A1", Active: true})
	_ = saveOrUpdateProduct(db, Product{Barcode: "BAR-2", Name: "Prod 2", Price: 20.0, Stock: 50, Location: "EST-A2", Active: true})
	_ = saveOrUpdateProduct(db, Product{Barcode: "BAR-3", Name: "Prod 3 (Archived)", Price: 5.0, Stock: 10, Location: "EST-A1", Active: false})

	// Start session for ALL
	sess, err := startInventorySession(db, "Inventario General", "Julian", "ALL", "Prueba")
	if err != nil {
		t.Fatalf("unexpected error starting session: %v", err)
	}
	if sess == nil || sess.ID == 0 {
		t.Fatalf("expected valid session returned")
	}
	if sess.TotalItems != 2 {
		t.Fatalf("expected 2 active products in snapshot, got %d", sess.TotalItems)
	}
	if sess.CountedItems != 0 {
		t.Fatalf("expected 0 counted items at start, got %d", sess.CountedItems)
	}

	items, err := listInventorySessionItems(db, sess.ID)
	if err != nil {
		t.Fatalf("error listing items: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	for _, it := range items {
		if it.IsCounted {
			t.Errorf("expected is_counted=false for initial snapshot")
		}
		if it.CountedQty != 0 {
			t.Errorf("expected counted_qty=0 for initial snapshot")
		}
		if it.Barcode == "BAR-1" && it.SystemStockAtStart != 25 {
			t.Errorf("expected system stock 25, got %d", it.SystemStockAtStart)
		}
	}
}

func TestInventorySession_CountEntriesAndDerivedTotal(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "BAR-SPLIT", Name: "Atun en Lata", Price: 5.0, Stock: 40, Location: "EST-A1", Active: true})
	sess, err := startInventorySession(db, "Audit Split", "Julian", "ALL", "")
	if err != nil {
		t.Fatalf("failed starting session: %v", err)
	}

	items, _ := listInventorySessionItems(db, sess.ID)
	item := items[0]

	// 1. Count 10 units on shelf EST-A1
	err = recordInventoryCountEntry(db, item.ID, "EST-A1", 10, false)
	if err != nil {
		t.Fatalf("failed recording entry: %v", err)
	}

	// 2. Count 30 units in Bodega BOD-01
	err = recordInventoryCountEntry(db, item.ID, "BOD-01", 30, false)
	if err != nil {
		t.Fatalf("failed recording second entry: %v", err)
	}

	// Verify derived counted_qty is 40
	updatedItems, _ := listInventorySessionItems(db, sess.ID)
	upItem := updatedItems[0]
	if upItem.CountedQty != 40 {
		t.Fatalf("expected derived counted_qty to be 40, got %d", upItem.CountedQty)
	}
	if !upItem.IsCounted {
		t.Fatalf("expected is_counted to be true")
	}
	if upItem.Variance != 0 { // 40 - 40 = 0
		t.Fatalf("expected variance 0, got %d", upItem.Variance)
	}
	if !strings.Contains(upItem.Breakdown, "BOD-01: 30") || !strings.Contains(upItem.Breakdown, "EST-A1: 10") {
		t.Fatalf("expected breakdown to contain both locations, got: %s", upItem.Breakdown)
	}

	// 3. Test Undo
	err = undoLastInventoryEntry(db, item.ID)
	if err != nil {
		t.Fatalf("failed undo: %v", err)
	}
	afterUndo, _ := listInventorySessionItems(db, sess.ID)
	if afterUndo[0].CountedQty != 39 {
		t.Fatalf("expected 39 after decrementing 1 from BOD-01, got %d", afterUndo[0].CountedQty)
	}
}

func TestInventorySession_UncountedSafetyAndSelectiveClose(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "BAR-COUNTED", Name: "Prod Counted", Price: 10.0, Stock: 20, Location: "EST-A1", Active: true})
	_ = saveOrUpdateProduct(db, Product{Barcode: "BAR-UNCOUNTED", Name: "Prod Uncounted", Price: 15.0, Stock: 50, Location: "EST-A2", Active: true})

	sess, _ := startInventorySession(db, "Audit Safety", "Julian", "ALL", "")
	items, _ := listInventorySessionItems(db, sess.ID)

	var countedItem, uncountedItem InventorySessionItem
	for _, it := range items {
		if it.Barcode == "BAR-COUNTED" {
			countedItem = it
		} else {
			uncountedItem = it
		}
	}

	// Count BAR-COUNTED to 25 (found 5 more)
	_ = recordInventoryCountEntry(db, countedItem.ID, "EST-A1", 25, true)

	// Close session requesting update for BOTH products (user accidentally checked both)
	// Safety guardrail must ONLY update BAR-COUNTED and SKIP BAR-UNCOUNTED because is_counted == false!
	err := closeInventorySession(db, sess.ID, []int64{countedItem.ProductID, uncountedItem.ProductID})
	if err != nil {
		t.Fatalf("failed closing session: %v", err)
	}

	// Verify database stock
	pCounted, _ := getProductByBarcode(db, "BAR-COUNTED")
	if pCounted.Stock != 25 {
		t.Errorf("expected BAR-COUNTED stock to be updated to 25, got %d", pCounted.Stock)
	}

	pUncounted, _ := getProductByBarcode(db, "BAR-UNCOUNTED")
	if pUncounted.Stock != 50 {
		t.Errorf("CRITICAL SAFETY FAILURE: BAR-UNCOUNTED stock was modified or zeroed out! Expected 50, got %d", pUncounted.Stock)
	}

	// Verify audit items record adjustment_applied
	finalItems, _ := listInventorySessionItems(db, sess.ID)
	for _, fi := range finalItems {
		if fi.Barcode == "BAR-COUNTED" && (!fi.AdjustmentApplied || *fi.StockAfter != 25) {
			t.Errorf("expected adjustment_applied=true and stock_after=25 for counted item")
		}
		if fi.Barcode == "BAR-UNCOUNTED" && fi.AdjustmentApplied {
			t.Errorf("expected adjustment_applied=false for uncounted item")
		}
	}
}

func TestInventorySession_SingleActiveSessionConstraint(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "BAR-1", Name: "Prod 1", Price: 10.0, Stock: 10, Active: true})

	sess1, err := startInventorySession(db, "First Audit", "Julian", "ALL", "")
	if err != nil {
		t.Fatalf("expected first session to start: %v", err)
	}
	if sess1 == nil {
		t.Fatalf("expected sess1 non-nil")
	}

	// Attempting to start a second session must fail
	sess2, err := startInventorySession(db, "Second Audit", "Julian", "ALL", "")
	if err == nil {
		t.Fatalf("expected error starting concurrent session, but succeeded with ID %d", sess2.ID)
	}

	// Cancel first session
	err = cancelInventorySession(db, sess1.ID)
	if err != nil {
		t.Fatalf("failed cancelling session: %v", err)
	}

	// Now starting another session must succeed
	sess3, err := startInventorySession(db, "Third Audit", "Julian", "ALL", "")
	if err != nil {
		t.Fatalf("expected session to start after previous was cancelled, got %v", err)
	}
	if sess3.ID == 0 {
		t.Fatalf("expected valid sess3 ID")
	}
}

func TestInventorySession_ExportCSV(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "CSV-1", Name: "Arroz 1kg", Price: 3500.0, Stock: 10, Location: "EST-A1", Active: true})
	sess, _ := startInventorySession(db, "Inventario CSV Test", "Julian", "ALL", "Notas")

	items, _ := listInventorySessionItems(db, sess.ID)
	_ = recordInventoryCountEntry(db, items[0].ID, "EST-A1", 8, false)

	csvData, err := exportSessionReportCSV(db, sess.ID)
	if err != nil {
		t.Fatalf("unexpected error exporting CSV: %v", err)
	}
	if !strings.Contains(csvData, "REPORTE DE TOMA DE INVENTARIO - iLuz") {
		t.Errorf("expected CSV to contain header")
	}
	if !strings.Contains(csvData, "Arroz 1kg") || !strings.Contains(csvData, "CSV-1") {
		t.Errorf("expected CSV to contain product data")
	}
	if !strings.Contains(csvData, "EST-A1: 8") {
		t.Errorf("expected CSV to contain location breakdown")
	}
}

func TestInventorySession_ZoneScopeMatching(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "ZONE-1", Name: "Exact Match", Price: 10, Stock: 5, Location: "EST-A1", Active: true})
	_ = saveOrUpdateProduct(db, Product{Barcode: "ZONE-2", Name: "Composite Match", Price: 10, Stock: 5, Location: "EST-A1 - Estante A1 Principal", Active: true})
	_ = saveOrUpdateProduct(db, Product{Barcode: "ZONE-3", Name: "Other Shelf", Price: 10, Stock: 5, Location: "EST-A2 - Estante A2", Active: true})
	_ = saveOrUpdateProduct(db, Product{Barcode: "ZONE-4", Name: "Prefix Collision", Price: 10, Stock: 5, Location: "EST-A10 - Estante A10", Active: true})

	sess, err := startInventorySession(db, "Zone Audit", "Julian", "EST-A1", "")
	if err != nil {
		t.Fatalf("failed starting zone session: %v", err)
	}

	items, err := listInventorySessionItems(db, sess.ID)
	if err != nil {
		t.Fatalf("failed listing session items: %v", err)
	}

	if len(items) != 2 {
		t.Fatalf("expected exactly 2 items matching EST-A1, got %d", len(items))
	}

	barcodes := make(map[string]bool)
	for _, it := range items {
		barcodes[it.Barcode] = true
	}
	if !barcodes["ZONE-1"] || !barcodes["ZONE-2"] {
		t.Errorf("expected ZONE-1 and ZONE-2 to be captured in snapshot, got: %+v", barcodes)
	}
	if barcodes["ZONE-3"] || barcodes["ZONE-4"] {
		t.Errorf("ZONE-3 or ZONE-4 should not be in snapshot, got: %+v", barcodes)
	}
}

func TestInventorySession_BackendStockFreeze(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	p := Product{Barcode: "FREEZE-1", Name: "Item Frozen", Price: 20.0, Stock: 15, Active: true}
	_ = saveOrUpdateProduct(db, p)

	// Verify initial stock
	saved, _ := getProductByBarcode(db, "FREEZE-1")
	if saved.Stock != 15 {
		t.Fatalf("expected initial stock 15, got %d", saved.Stock)
	}

	// 1. Start an inventory audit session
	sess, err := startInventorySession(db, "Audit Active", "Julian", "ALL", "")
	if err != nil {
		t.Fatalf("failed starting session: %v", err)
	}

	// 2. Attempt to update stock while session is in progress
	saved.Stock = 999
	saved.Price = 25.0 // Non-stock fields should still update
	err = saveOrUpdateProduct(db, *saved)
	if err != nil {
		t.Fatalf("saveOrUpdateProduct returned error: %v", err)
	}

	// Verify stock was FROZEN to 15, but price updated to 25
	duringAudit, _ := getProductByBarcode(db, "FREEZE-1")
	if duringAudit.Stock != 15 {
		t.Errorf("CRITICAL: stock freeze failed during active audit! Expected 15, got %d", duringAudit.Stock)
	}
	if duringAudit.Price != 25.0 {
		t.Errorf("expected price to update to 25.0, got %f", duringAudit.Price)
	}

	// 3. Close the audit session
	_ = cancelInventorySession(db, sess.ID)

	// 4. Update stock now that audit is closed
	duringAudit.Stock = 42
	err = saveOrUpdateProduct(db, *duringAudit)
	if err != nil {
		t.Fatalf("saveOrUpdateProduct error after audit closed: %v", err)
	}

	afterAudit, _ := getProductByBarcode(db, "FREEZE-1")
	if afterAudit.Stock != 42 {
		t.Errorf("expected stock to update to 42 after audit closed, got %d", afterAudit.Stock)
	}
}

func TestInventorySession_ClosedSessionRejectsCounts(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "GUARD-1", Name: "Guarded Item", Price: 10, Stock: 5, Active: true})
	sess, _ := startInventorySession(db, "Guard Test", "Julian", "ALL", "")
	items, _ := listInventorySessionItems(db, sess.ID)
	itemID := items[0].ID

	// Count 2 while active
	err := recordInventoryCountEntry(db, itemID, "EST-A1", 2, false)
	if err != nil {
		t.Fatalf("expected count to succeed on active session: %v", err)
	}

	// Cancel session
	_ = cancelInventorySession(db, sess.ID)

	// Attempt count on cancelled session must fail
	err = recordInventoryCountEntry(db, itemID, "EST-A1", 3, false)
	if err == nil {
		t.Fatalf("expected error recording count on cancelled session, but succeeded")
	}

	// Attempt undo on cancelled session must fail
	err = undoLastInventoryEntry(db, itemID)
	if err == nil {
		t.Fatalf("expected error undoing count on cancelled session, but succeeded")
	}
}


