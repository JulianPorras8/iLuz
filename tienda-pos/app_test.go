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
	if app.GetCurrentPort() != "COM4" {
		t.Errorf("expected current port to be COM4, got %s", app.GetCurrentPort())
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

	err = app.RestoreProduct("770001")
	if err != nil {
		t.Fatalf("failed restoring product: %v", err)
	}

	// 7. Test ExportInventoryCSV
	csvContent, err := app.ExportInventoryCSV()
	if err != nil {
		t.Fatalf("failed generating inventory CSV: %v", err)
	}

	// Must start with UTF-8 BOM
	if !strings.HasPrefix(csvContent, "\xef\xbb\xbf") {
		t.Errorf("expected CSV to start with UTF-8 BOM")
	}

	// Must contain standard header
	if !strings.Contains(csvContent, "Código,Nombre,Precio,Stock,Unidad,Peso,Tamaño,Color,Ubicación,Estado") {
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
