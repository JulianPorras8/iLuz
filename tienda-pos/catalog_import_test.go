package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestCatalogImport_CleanCSVNumberAndBulkDetection(t *testing.T) {
	// cleanCSVNumber tests
	if v := cleanCSVNumber(""); v != 0 {
		t.Errorf("expected 0, got %f", v)
	}
	if v := cleanCSVNumber("PENDIENTE"); v != 0 {
		t.Errorf("expected 0, got %f", v)
	}
	if v := cleanCSVNumber("Pendiente por Costear"); v != 0 {
		t.Errorf("expected 0, got %f", v)
	}
	if v := cleanCSVNumber("$ 12,500"); v != 12500 {
		t.Errorf("expected 12500, got %f", v)
	}
	if v := cleanCSVNumber("1.500.000"); v != 1500000 {
		t.Errorf("expected 1500000, got %f", v)
	}
	if v := cleanCSVNumber("250.75"); v != 250.75 {
		t.Errorf("expected 250.75, got %f", v)
	}

	// isCatalogBulkItem tests
	if !isCatalogBulkItem("HUEVO ROJO TIPO AA", "Lácteos, Huevos y Refrigerados") {
		t.Errorf("expected huevo to be bulk item")
	}
	if !isCatalogBulkItem("PAN ARTESANAL UNIDAD", "Panadería, Repostería y Dulcería") {
		t.Errorf("expected pan to be bulk item")
	}
	if !isCatalogBulkItem("CARNE DE RES LB", "Carnes y Embutidos") {
		t.Errorf("expected carne to be bulk item")
	}
	if !isCatalogBulkItem("BOMBÓN BUM ROJO", "Panadería, Repostería y Dulcería") {
		t.Errorf("expected bombon to be bulk item")
	}
	if !isCatalogBulkItem("YUCA LB", "Abarrotes y Despensa") {
		t.Errorf("expected yuca to be bulk item")
	}
	if isCatalogBulkItem("ACEITE FRITÓN 1000 ML", "Abarrotes y Despensa") {
		t.Errorf("expected aceite not to be bulk item")
	}
}

func TestCatalogImport_ValidationErrors(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Empty CSV
	_, err := importCatalogCSVTx(db, "")
	if err == nil {
		t.Errorf("expected error for empty CSV")
	}

	// Corrupted CSV
	_, err = importCatalogCSVTx(db, "a,b,c\n1,2\"3,4")
	if err == nil {
		t.Errorf("expected error for corrupted CSV")
	}

	// Only header, no data
	_, err = importCatalogCSVTx(db, "ARTICULO,CATEGORIA,PRECIO_VENTA_SUGERIDO_COP\n")
	if err == nil {
		t.Errorf("expected error for CSV without data records")
	}

	// Missing ARTICULO/NOMBRE column
	_, err = importCatalogCSVTx(db, "CODIGO,CANTIDAD,PRECIO\n1,10,500\n")
	if err == nil {
		t.Errorf("expected error when ARTICULO column is missing")
	}
}

func TestCatalogImport_FullFlowAndRealFile(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Import mini CSV with semicolon and comma delimiters
	miniCSV := `ID;CATEGORIA;ARTICULO;CANTIDAD_STOCK;PRECIO_COSTO_COP;PRECIO_VENTA_SUGERIDO_COP;MARGEN_ESTIMADO;ESTADO_COSTO;ESTANTE_ORIGINAL
1;Abarrotes;ARROZ DIANA 500G;10;1700;2100;19%;Costeado;Estante 1
2;Panadería;PAN ARTESANAL UNIDAD;20;300;500;40%;Costeado;Estante 2
3;Abarrotes;SAL REFISAL 1KG;0;800;1000;20%;Costeado;Estante 1
`
	res, err := importCatalogCSVTx(db, miniCSV)
	if err != nil {
		t.Fatalf("unexpected error importing mini CSV: %v", err)
	}
	if res.TotalProcessed != 3 || res.Inserted != 3 || res.Updated != 0 {
		t.Errorf("unexpected result: %+v", res)
	}

	// Verify items in DB
	prods, err := listAllProducts(db)
	if err != nil {
		t.Fatalf("error listing products: %v", err)
	}
	if len(prods) != 3 {
		t.Fatalf("expected 3 products, got %d", len(prods))
	}

	var panProduct Product
	for _, p := range prods {
		if p.Name == "PAN ARTESANAL UNIDAD" {
			panProduct = p
		}
	}
	if !panProduct.IsQuickAccess {
		t.Errorf("expected pan to have isQuickAccess=true")
	}
	if panProduct.Category != "Panadería" {
		t.Errorf("expected category Panadería, got %s", panProduct.Category)
	}

	// 2. Re-importing same items should update without creating duplicates
	miniCSVUpdate := `ID,CATEGORIA,ARTICULO,CANTIDAD_STOCK,PRECIO_COSTO_COP,PRECIO_VENTA_SUGERIDO_COP,ESTANTE_ORIGINAL
1,Abarrotes,ARROZ DIANA 500G,15,1800,2300,Estante 1
`
	resUpdate, err := importCatalogCSVTx(db, miniCSVUpdate)
	if err != nil {
		t.Fatalf("error re-importing: %v", err)
	}
	if resUpdate.Updated != 1 || resUpdate.Inserted != 0 {
		t.Errorf("expected 1 updated, got %+v", resUpdate)
	}

	// Verify stock and price updated
	updatedProds, _ := listAllProducts(db)
	if len(updatedProds) != 3 {
		t.Fatalf("count changed after re-import: %d", len(updatedProds))
	}

	// 3. Import the REAL 631 products CSV file into a clean database
	csvPath := filepath.Join("data", "inventario_organizado.csv")
	if content, err := os.ReadFile(csvPath); err == nil {
		cleanDB, cleanClose := setupTestDB(t)
		defer cleanClose()

		resReal, err := importCatalogCSVTx(cleanDB, string(content))
		if err != nil {
			t.Fatalf("failed importing real catalog CSV: %v", err)
		}
		if resReal.TotalProcessed != 631 {
			t.Errorf("expected 631 total processed, got %d", resReal.TotalProcessed)
		}
		if len(resReal.Errors) > 0 {
			t.Errorf("unexpected import errors: %v", resReal.Errors)
		}

		all, err := listAllProducts(cleanDB)
		if err != nil {
			t.Fatalf("failed listing products: %v", err)
		}
		if len(all) != 631 {
			t.Errorf("expected 631 unique products in DB, got %d", len(all))
		}
	}
}

func TestBarcodeLinking_FlowAndEdges(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Create test products
	p1 := Product{Barcode: "ILUZ-0001", Name: "Arroz Diana 500g", Price: 2100, Stock: 10, Active: true}
	p2 := Product{Barcode: "7702001041412", Name: "Aceite Fritón 1L", Price: 8100, Stock: 5, Active: true}
	if err := saveOrUpdateProduct(db, p1); err != nil {
		t.Fatalf("save p1 failed: %v", err)
	}
	if err := saveOrUpdateProduct(db, p2); err != nil {
		t.Fatalf("save p2 failed: %v", err)
	}

	prods, _ := listAllProducts(db)
	var p1ID int64
	for _, p := range prods {
		if p.Barcode == "ILUZ-0001" {
			p1ID = p.ID
		}
	}

	// Error: empty barcode
	if err := linkBarcodeToProductDB(db, p1ID, ""); err == nil {
		t.Errorf("expected error for empty barcode")
	}

	// Error: invalid product ID
	if err := linkBarcodeToProductDB(db, 0, "7701234567890"); err == nil {
		t.Errorf("expected error for productID <= 0")
	}
	if err := linkBarcodeToProductDB(db, 999999, "7701234567890"); err == nil {
		t.Errorf("expected error for non-existent product ID")
	}

	// Error: barcode collision (barcode belongs to p2)
	if err := linkBarcodeToProductDB(db, p1ID, "7702001041412"); err == nil {
		t.Errorf("expected collision error when linking existing barcode")
	}

	// Success: link real EAN barcode to p1
	realBarcode := "7702001999999"
	if err := linkBarcodeToProductDB(db, p1ID, realBarcode); err != nil {
		t.Fatalf("failed to link barcode: %v", err)
	}

	linked, err := getProductByBarcode(db, realBarcode)
	if err != nil {
		t.Fatalf("failed to find linked product: %v", err)
	}
	if linked.ID != p1ID || linked.Barcode != realBarcode {
		t.Errorf("unexpected linked product: %+v", linked)
	}
}

func TestApp_CatalogImportAndLinkMethods(t *testing.T) {
	app := NewApp()

	// 1. Error when db is nil
	if _, err := app.ImportCatalogCSV("ARTICULO\nTest"); err == nil {
		t.Errorf("expected error with nil db")
	}
	if _, err := app.ImportCatalogFromFile("data/inventario_organizado.csv"); err == nil {
		t.Errorf("expected error with nil db")
	}
	if err := app.LinkBarcodeToProduct(1, "770123"); err == nil {
		t.Errorf("expected error with nil db")
	}

	// 2. Initialize with test DB
	var cleanup func()
	app.db, cleanup = setupTestDB(t)
	defer cleanup()
	app.ctx = context.Background()

	// Error non-existent file
	if _, err := app.ImportCatalogFromFile("non_existent_file.csv"); err == nil {
		t.Errorf("expected error for non-existent file")
	}

	// Import from real file
	res, err := app.ImportCatalogFromFile("data/inventario_organizado.csv")
	if err != nil {
		t.Fatalf("error importing from file: %v", err)
	}
	if res.TotalProcessed < 600 {
		t.Errorf("expected >= 600 products, got %d", res.TotalProcessed)
	}

	// Import CSV string
	csvStr := "ARTICULO,CATEGORIA,PRECIO_VENTA_SUGERIDO_COP\nPRODUCTO EXTRA,Varios,1500\n"
	resStr, err := app.ImportCatalogCSV(csvStr)
	if err != nil {
		t.Fatalf("error importing csv string: %v", err)
	}
	if resStr.Inserted != 1 {
		t.Errorf("expected 1 inserted, got %+v", resStr)
	}

	// Link barcode via App
	all, _ := app.ListInventoryProducts(true)
	var targetID int64
	for _, p := range all {
		if p.Name == "PRODUCTO EXTRA" {
			targetID = p.ID
			break
		}
	}
	if targetID == 0 {
		t.Fatalf("could not find PRODUCTO EXTRA")
	}

	if err := app.LinkBarcodeToProduct(targetID, "770999900001"); err != nil {
		t.Fatalf("failed to link barcode via App: %v", err)
	}

	found, err := app.SearchBarcode("770999900001")
	if err != nil || found == nil {
		t.Errorf("expected to find linked barcode: %v", err)
	}
}

func TestCatalogImport_DeepEdges(t *testing.T) {
	db, cleanup := setupTestDB(t)
	cleanup() // close db to test db error branches

	if _, err := importCatalogCSVTx(db, "ARTICULO\nTest Item"); err == nil {
		t.Errorf("expected error on closed db")
	}

	if err := linkBarcodeToProductDB(db, 1, "770111"); err == nil {
		t.Errorf("expected error on closed db")
	}

	// Test bulk items and custom barcodes
	db2, cleanup2 := setupTestDB(t)
	defer cleanup2()

	// Pre-insert an item to cause duplicate barcode branch
	_ = saveOrUpdateProduct(db2, Product{Barcode: "CUSTOM-01", Name: "Existing", Price: 100})

	edgeCSV := `ARTICULO,CATEGORIA,BARCODE
,Abarrotes,IGNORE
MOLIDA DE RES KILO,Carnes y Embutidos,CUSTOM-01
PECHUGA KILO,Carnes y Embutidos,CUSTOM-02
`
	res, err := importCatalogCSVTx(db2, edgeCSV)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Inserted != 2 {
		t.Errorf("expected 2 inserted, got %d", res.Inserted)
	}

	// Verify that inventory session items update on linkBarcodeToProductDB
	p := Product{Barcode: "ILUZ-9999", Name: "LinkTarget", Price: 1000, Stock: 5, Active: true}
	_ = saveOrUpdateProduct(db2, p)
	prods, _ := listAllProducts(db2)
	var pID int64
	for _, pr := range prods {
		if pr.Barcode == "ILUZ-9999" {
			pID = pr.ID
			break
		}
	}

	session, _ := startInventorySession(db2, "Auditoría Test", "Tester", "ALL", "")

	if err := linkBarcodeToProductDB(db2, pID, "NEW-BAR-9999"); err != nil {
		t.Fatalf("error linking barcode: %v", err)
	}

	items, err := listInventorySessionItems(db2, session.ID)
	if err != nil {
		t.Fatalf("error listing items: %v", err)
	}
	foundNewBarcode := false
	for _, it := range items {
		if it.Barcode == "NEW-BAR-9999" {
			foundNewBarcode = true
			break
		}
	}
	if !foundNewBarcode {
		t.Errorf("expected inventory session item to have updated barcode")
	}
}

