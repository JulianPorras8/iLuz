package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAppLifecycleAndCRUD(t *testing.T) {
	app := NewApp()
	if app.GetCurrentPort() != "COM3" {
		t.Errorf("expected default port COM3, got %s", app.GetCurrentPort())
	}

	initialStatus := app.GetScannerStatus()
	if initialStatus.Port != "COM3" {
		t.Errorf("expected initial status port COM3, got %s", initialStatus.Port)
	}

	// Use temporary test db
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "app_test.db")
	db := initDB(dbPath)
	defer func() {
		_ = db.Close()
		_ = os.Remove(dbPath)
	}()

	app.ctx = context.Background()
	app.db = db

	// 1. Test SaveProduct
	prod := Product{
		Barcode: "123456",
		Name:    "Gaseosa 1.5L",
		Price:   5000.0,
		Stock:   10,
		Active:  true,
	}
	err := app.SaveProduct(prod)
	if err != nil {
		t.Fatalf("unexpected error saving product via App: %v", err)
	}

	// 2. Test SearchBarcode
	found, err := app.SearchBarcode("123456")
	if err != nil {
		t.Fatalf("unexpected error searching barcode via App: %v", err)
	}
	if found.Name != "Gaseosa 1.5L" {
		t.Errorf("expected product name 'Gaseosa 1.5L', got %s", found.Name)
	}

	// 3. Test GetAllProducts
	all, err := app.GetAllProducts()
	if err != nil {
		t.Fatalf("unexpected error getting all products: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 product, got %d", len(all))
	}

	// 4. Test ProcessBarcode
	scanRes := app.ProcessBarcode("123456")
	if !scanRes.Found {
		t.Errorf("expected scanned barcode to be found")
	}
	if scanRes.Product == nil || scanRes.Product.Name != "Gaseosa 1.5L" {
		t.Errorf("expected product 'Gaseosa 1.5L', got %+v", scanRes.Product)
	}

	// 5. Test Port Switching
	app.SetScannerPort("COM4")
	app.SetScannerPort("COM5")
	if app.GetCurrentPort() != "COM5" {
		t.Errorf("expected current port to be COM5, got %s", app.GetCurrentPort())
	}

	// 6. Test Shutdown
	app.shutdown(context.Background())
}

func TestAppExtendedModulesAndCSVExport(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "app_extended_test.db")
	db := initDB(dbPath)
	defer func() {
		_ = db.Close()
		_ = os.Remove(dbPath)
	}()

	app.ctx = context.Background()
	app.db = db

	// 1. Create location via App
	loc := Location{
		Code:        "EST-B1",
		Name:        "Estante B Nivel 1",
		Description: "Bebidas frías",
	}
	err := app.SaveLocation(loc)
	if err != nil {
		t.Fatalf("failed saving location via App: %v", err)
	}

	locations, err := app.GetAllLocations()
	if err != nil || len(locations) != 1 {
		t.Fatalf("expected 1 location via App, got %d (err: %v)", len(locations), err)
	}

	// 2. Create products: one with barcode, one without (manual)
	p1 := Product{
		Barcode:       "770001",
		Name:          "Jugo de Naranja 500ml",
		Price:         2200.0,
		Stock:         15,
		UnitOfMeasure: "ml",
		Location:      "EST-B1",
		Active:        true,
	}
	_ = app.SaveProduct(p1)

	pManual := Product{
		Barcode:       "", // manual item without barcode
		Name:          "Manzana Criolla",
		Price:         800.0,
		Stock:         50,
		UnitOfMeasure: "und",
		Active:        true,
	}
	_ = app.SaveProduct(pManual)

	// 3. Test ListInventoryProducts
	inv, err := app.ListInventoryProducts(true)
	if err != nil || len(inv) != 2 {
		t.Fatalf("expected 2 inventory products, got %d (err: %v)", len(inv), err)
	}

	// 4. Test UpdateProductLocation
	err = app.UpdateProductLocation("770001", "EST-B2")
	if err != nil {
		t.Fatalf("failed updating product location: %v", err)
	}
	updatedP1, _ := app.SearchBarcode("770001")
	if updatedP1.Location != "EST-B2" {
		t.Errorf("expected location 'EST-B2', got '%s'", updatedP1.Location)
	}

	// 5. Test SearchProducts (POS autocomplete by name/code)
	results, err := app.SearchProducts("Manzana")
	if err != nil || len(results) != 1 {
		t.Fatalf("expected 1 search result for 'Manzana', got %d (err: %v)", len(results), err)
	}
	if results[0].Name != "Manzana Criolla" {
		t.Errorf("expected 'Manzana Criolla', got '%s'", results[0].Name)
	}

	// 6. Test Archive & Restore via App
	err = app.ArchiveProduct("770001")
	if err != nil {
		t.Fatalf("failed archiving product: %v", err)
	}
	activeList, _ := app.ListInventoryProducts(false)
	if len(activeList) != 1 {
		t.Errorf("expected 1 active item after archiving, got %d", len(activeList))
	}

	// 7. Test ExportInventoryCSV (while 770001 is archived, covering 'Archivado' branch)
	csvContent, err := app.ExportInventoryCSV()
	if err != nil {
		t.Fatalf("failed generating inventory CSV: %v", err)
	}
	if !strings.Contains(csvContent, "Archivado") {
		t.Errorf("expected CSV to contain 'Archivado'")
	}

	err = app.RestoreProduct("770001")
	if err != nil {
		t.Fatalf("failed restoring product: %v", err)
	}

	// Must start with UTF-8 BOM
	if !strings.HasPrefix(csvContent, "\xef\xbb\xbf") {
		t.Errorf("expected CSV to start with UTF-8 BOM")
	}

	// Must contain standard header with Precio Costo and Contenido / Peso
	if !strings.Contains(csvContent, "Código,Nombre,Precio Costo,Precio Venta,Stock,Unidad,Contenido / Peso,Tamaño,Color,Ubicación,Estado") {
		t.Errorf("CSV header missing or formatted incorrectly:\n%s", csvContent)
	}

	// Must contain the product names
	if !strings.Contains(csvContent, "Jugo de Naranja 500ml") || !strings.Contains(csvContent, "Manzana Criolla") {
		t.Errorf("CSV missing product rows:\n%s", csvContent)
	}

	// 8. Test DeleteLocation via App
	err = app.DeleteLocation(locations[0].ID)
	if err != nil {
		t.Fatalf("failed deleting location: %v", err)
	}
}

func TestApp_InventorySessionsAndAuditFlow(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "app_inv_test.db")
	db := initDB(dbPath)
	defer func() {
		_ = db.Close()
		_ = os.Remove(dbPath)
	}()

	app.ctx = context.Background()
	app.db = db

	// Pre-populate products
	p1 := Product{Barcode: "BAR-A1", Name: "Producto A1", Price: 1000.0, Stock: 20, Location: "EST-A1", Active: true}
	p2 := Product{Barcode: "BAR-B1", Name: "Producto B1 (Otro Estante)", Price: 2000.0, Stock: 10, Location: "EST-B1", Active: true}
	_ = app.SaveProduct(p1)
	_ = app.SaveProduct(p2)

	// 1. Verify no active session at start
	activeSess, err := app.GetActiveInventorySession()
	if err != nil {
		t.Fatalf("unexpected error getting active session: %v", err)
	}
	if activeSess != nil {
		t.Errorf("expected no active session initially, got: %+v", activeSess)
	}

	// 2. Start inventory session scoped to EST-A1
	sess, err := app.StartInventorySession("Toma Estante A", "Julian", "EST-A1", "Notas de auditoría")
	if err != nil {
		t.Fatalf("failed starting inventory session via App: %v", err)
	}
	if sess == nil || sess.ID == 0 {
		t.Fatalf("expected valid session returned")
	}

	// 3. Verify GetActiveInventorySession now returns it
	activeSess, err = app.GetActiveInventorySession()
	if err != nil || activeSess == nil || activeSess.ID != sess.ID {
		t.Fatalf("expected active session ID %d, got %+v (err: %v)", sess.ID, activeSess, err)
	}

	// 4. List items in session (should have BAR-A1)
	items, err := app.ListInventorySessionItems(sess.ID)
	if err != nil || len(items) != 1 {
		t.Fatalf("expected 1 item in snapshot for EST-A1, got %d (err: %v)", len(items), err)
	}
	itemID := items[0].ID

	// 5. Test RecordInventoryScan: valid scan
	scannedItem, err := app.RecordInventoryScan(sess.ID, "BAR-A1", "EST-A1")
	if err != nil {
		t.Fatalf("failed recording scan via App: %v", err)
	}
	if scannedItem == nil || scannedItem.CountedQty != 1 || !scannedItem.IsCounted {
		t.Errorf("expected counted_qty=1 and is_counted=true, got %+v", scannedItem)
	}

	// 6. Test RecordInventoryScan: scanning out-of-scope product (BAR-B1) appends it dynamically
	scannedOutOfScope, err := app.RecordInventoryScan(sess.ID, "BAR-B1", "EST-A1")
	if err != nil {
		t.Fatalf("failed recording out-of-scope scan via App: %v", err)
	}
	if scannedOutOfScope == nil || scannedOutOfScope.Barcode != "BAR-B1" {
		t.Errorf("expected BAR-B1 to be dynamically appended to session, got %+v", scannedOutOfScope)
	}

	// 7. Test RecordInventoryScan error conditions
	// Empty barcode
	_, err = app.RecordInventoryScan(sess.ID, "  ", "EST-A1")
	if err == nil || !strings.Contains(err.Error(), "código de barras vacío") {
		t.Errorf("expected empty barcode error, got: %v", err)
	}

	// Unknown barcode
	_, err = app.RecordInventoryScan(sess.ID, "NON-EXISTENT-999", "EST-A1")
	if err == nil || !strings.Contains(err.Error(), "UNKNOWN_BARCODE:NON-EXISTENT-999") {
		t.Errorf("expected UNKNOWN_BARCODE error, got: %v", err)
	}

	// Non-existent session
	_, err = app.RecordInventoryScan(999999, "BAR-A1", "EST-A1")
	if err == nil {
		t.Errorf("expected error for non-existent session ID")
	}

	// 8. Test RecordBatchCount via App
	err = app.RecordBatchCount(itemID, "EST-A1", 15, true)
	if err != nil {
		t.Fatalf("failed recording batch count via App: %v", err)
	}
	refreshedItems, _ := app.ListInventorySessionItems(sess.ID)
	for _, it := range refreshedItems {
		if it.ID == itemID && it.CountedQty != 15 {
			t.Errorf("expected counted_qty 15 after replace batch count, got %d", it.CountedQty)
		}
	}

	// 9. Test UndoLastCount via App
	err = app.UndoLastCount(itemID)
	if err != nil {
		t.Fatalf("failed undoing last count via App: %v", err)
	}
	refreshedItems, _ = app.ListInventorySessionItems(sess.ID)
	for _, it := range refreshedItems {
		if it.ID == itemID && it.CountedQty != 14 {
			t.Errorf("expected counted_qty 14 after undo, got %d", it.CountedQty)
		}
	}

	// 10. Test ExportInventorySessionCSV
	csvStr, err := app.ExportInventorySessionCSV(sess.ID)
	if err != nil {
		t.Fatalf("failed exporting session CSV via App: %v", err)
	}
	if !strings.Contains(csvStr, "Toma Estante A") || !strings.Contains(csvStr, "BAR-A1") {
		t.Errorf("CSV missing session details or products:\n%s", csvStr)
	}

	// 11. Test Export file dialog fallbacks (headless context)
	_, err = app.ExportInventoryCSVFile()
	if err == nil || !strings.Contains(err.Error(), "contexto de frontend no disponible") {
		t.Errorf("expected headless context error from ExportInventoryCSVFile, got: %v", err)
	}

	_, err = app.ExportInventorySessionCSVFile(sess.ID)
	if err == nil || !strings.Contains(err.Error(), "contexto de frontend no disponible") {
		t.Errorf("expected headless context error from ExportInventorySessionCSVFile, got: %v", err)
	}

	// 12. Test CloseInventorySession via App
	err = app.CloseInventorySession(sess.ID, []int64{items[0].ProductID})
	if err != nil {
		t.Fatalf("failed closing session via App: %v", err)
	}

	// 13. Test Cancel another session via App
	sess2, err := app.StartInventorySession("Toma a Cancelar", "Julian", "ALL", "")
	if err != nil {
		t.Fatalf("failed starting second session: %v", err)
	}
	err = app.CancelInventorySession(sess2.ID)
	if err != nil {
		t.Fatalf("failed cancelling session via App: %v", err)
	}

	// 14. Test ListCompletedInventorySessions via App
	completed, err := app.ListCompletedInventorySessions()
	if err != nil {
		t.Fatalf("failed listing completed sessions via App: %v", err)
	}
	if len(completed) != 2 {
		t.Fatalf("expected 2 completed/cancelled sessions, got %d", len(completed))
	}

	// 15. Test error branches
	if err := app.RecordBatchCount(-1, "EST-A1", 5, false); err == nil {
		t.Errorf("expected error for invalid session item in RecordBatchCount")
	}
	if err := app.UndoLastCount(-1); err == nil {
		t.Errorf("expected error for invalid session item in UndoLastCount")
	}
	if err := app.CloseInventorySession(-1, nil); err == nil {
		t.Errorf("expected error for invalid session in CloseInventorySession")
	}
	if _, err := app.RecordInventoryScan(sess2.ID, "BAR-A1", "EST-A1"); err == nil {
		t.Errorf("expected error scanning into cancelled session")
	}
}

func TestApp_LifecycleAndStatus(t *testing.T) {
	app := NewApp()

	// Available ports
	ports := app.GetAvailablePorts()
	if ports == nil {
		t.Errorf("expected non-nil ports slice")
	}

	// Emit status and domReady
	app.EmitScannerStatus()
	app.domReady(context.Background())

	// Startup in temp directory
	tmpDir := t.TempDir()
	origDir, err := os.Getwd()
	if err == nil {
		_ = os.Chdir(tmpDir)
		defer func() { _ = os.Chdir(origDir) }()
	}

	appStartup := NewApp()
	appStartup.startup(context.Background())
	if appStartup.db == nil {
		t.Errorf("expected app.db to be initialized after startup")
	}
	appStartup.shutdown(context.Background())
}

func TestApp_ErrorHandling(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "app_err_test.db")
	db := initDB(dbPath)
	app.ctx = context.Background()
	app.db = db

	// Close db to force database errors on wrappers
	_ = db.Close()

	if err := app.SaveProduct(Product{Name: "Item"}); err == nil {
		t.Errorf("expected error on closed db for SaveProduct")
	}
	if err := app.UpdateProductLocation("123", "EST"); err == nil {
		t.Errorf("expected error on closed db for UpdateProductLocation")
	}
	if err := app.ArchiveProduct("123"); err == nil {
		t.Errorf("expected error on closed db for ArchiveProduct")
	}
	if err := app.RestoreProduct("123"); err == nil {
		t.Errorf("expected error on closed db for RestoreProduct")
	}
	if _, err := app.ExportInventoryCSV(); err == nil {
		t.Errorf("expected error on closed db for ExportInventoryCSV")
	}
}

