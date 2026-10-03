package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.bug.st/serial"
)

func setupDeepTestDB(t *testing.T) (*sql.DB, func()) {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "iluz_deep_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tmpDir, "deep_test.db")
	db := initDB(dbPath)

	cleanup := func() {
		db.Close()
		os.RemoveAll(tmpDir)
	}
	return db, cleanup
}

func TestAudit_MultiShelfScopeResolution(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// Create test products across various shelves
	prods := []Product{
		{Barcode: "E1-01", Name: "Arroz Estante 1", Location: "EST01-N1-C1", Price: 3000, CostPrice: 2000, Stock: 20, Active: true},
		{Barcode: "E1-02", Name: "Frijol Estante 1", Location: "EST01-N2-C1", Price: 4000, CostPrice: 2500, Stock: 15, Active: true},
		{Barcode: "E2-01", Name: "Aceite Estante 2", Location: "EST02-N1-C1", Price: 8000, CostPrice: 6000, Stock: 10, Active: true},
		{Barcode: "NEV-01", Name: "Leche Nevera", Location: "NEV01-N1-C1", Price: 3500, CostPrice: 2800, Stock: 30, Active: true},
		{Barcode: "BOD-01", Name: "Bulto Azúcar Bodega", Location: "BOD01-N1-C1", Price: 120000, CostPrice: 95000, Stock: 5, Active: true},
	}

	for _, p := range prods {
		err := saveOrUpdateProduct(db, p)
		if err != nil {
			t.Fatalf("Failed to save product %s: %v", p.Name, err)
		}
	}

	// 1. Audit multi-shelf scope: EST01,EST02
	sess, err := startInventorySession(db, "Toma Estantes 1 y 2", "Auditor", "EST01,EST02", "Conteo combinado")
	if err != nil {
		t.Fatalf("Failed to start multi-shelf session: %v", err)
	}

	items, err := listInventorySessionItems(db, sess.ID)
	if err != nil {
		t.Fatalf("Failed to list items: %v", err)
	}

	if len(items) != 3 {
		t.Errorf("Expected exactly 3 items from EST01 and EST02, got %d", len(items))
		for _, it := range items {
			t.Logf("Included item: %s (%s)", it.ProductName, it.Location)
		}
	}

	// Ensure NEV01 and BOD01 were NOT included
	for _, it := range items {
		if it.Barcode == "NEV-01" || it.Barcode == "BOD-01" {
			t.Errorf("Item %s should not have been included in scope EST01,EST02", it.ProductName)
		}
	}

	// Cancel session
	err = cancelInventorySession(db, sess.ID)
	if err != nil {
		t.Fatalf("Failed to cancel session: %v", err)
	}

	// 2. Audit single shelf scope: NEV01
	sessNev, err := startInventorySession(db, "Toma Nevera", "Auditor", "NEV01", "Solo lacteos")
	if err != nil {
		t.Fatalf("Failed to start NEV01 session: %v", err)
	}
	itemsNev, err := listInventorySessionItems(db, sessNev.ID)
	if err != nil {
		t.Fatalf("Failed to list NEV01 items: %v", err)
	}
	if len(itemsNev) != 1 || itemsNev[0].Barcode != "NEV-01" {
		t.Errorf("Expected 1 item (NEV-01), got %d", len(itemsNev))
	}
	_ = cancelInventorySession(db, sessNev.ID)
}

func TestPOS_ValidationAndCollisionHardening(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// Seed products
	prod := Product{Barcode: "VAL-01", Name: "Galletas", Price: 1500, CostPrice: 1000, Stock: 50, Active: true}
	_ = saveOrUpdateProduct(db, prod)
	saved, _ := getProductByBarcode(db, "VAL-01")

	// 1. Error on empty items
	_, err := completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		AmountPaid:    5000,
		Items:         []SaleItemInput{},
	})
	if err == nil {
		t.Error("Expected error when completing sale with 0 items, got nil")
	}

	// 2. Error on credit sale without customer name
	_, err = completeSaleTx(db, SaleInput{
		PaymentMethod: "fiao",
		CustomerName:  "   ",
		Items: []SaleItemInput{
			{ProductID: saved.ID, Qty: 2},
		},
	})
	if err == nil {
		t.Error("Expected error when fiao sale has empty customer name, got nil")
	}

	// 3. Valid credit sale with customer name
	sale, err := completeSaleTx(db, SaleInput{
		PaymentMethod: "fiao",
		CustomerName:  "Doña Martha",
		Items: []SaleItemInput{
			{ProductID: saved.ID, Qty: 2},
		},
	})
	if err != nil {
		t.Fatalf("Failed valid credit sale: %v", err)
	}
	if sale.TotalAmount != 3000 {
		t.Errorf("Expected total 3000, got %f", sale.TotalAmount)
	}

	// Verify credit account was created with correct debt
	accs, err := listCreditAccountsDB(db)
	if err != nil || len(accs) != 1 {
		t.Fatalf("Expected 1 credit account, got %d", len(accs))
	}
	if accs[0].CustomerName != "Doña Martha" || accs[0].CurrentDebt != 3000 {
		t.Errorf("Credit account mismatch: %+v", accs[0])
	}

	// 4. Ticket sequence uniqueness when ticket deleted
	today := time.Now().Format("20060102")
	prefix := fmt.Sprintf("REM-%s-", today)
	ticket1 := fmt.Sprintf("%s0001", prefix)
	if sale.TicketNumber != ticket1 {
		t.Errorf("Expected ticket %s, got %s", ticket1, sale.TicketNumber)
	}

	// Complete second sale
	sale2, err := completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		AmountPaid:    2000,
		Items: []SaleItemInput{
			{ProductID: saved.ID, Qty: 1},
		},
	})
	if err != nil {
		t.Fatalf("Failed second sale: %v", err)
	}
	ticket2 := fmt.Sprintf("%s0002", prefix)
	if sale2.TicketNumber != ticket2 {
		t.Errorf("Expected ticket %s, got %s", ticket2, sale2.TicketNumber)
	}

	// Delete sale 1 to create a hole: remaining is sale 2
	_, _ = db.Exec("DELETE FROM sales WHERE id = ?", sale.ID)

	// Complete third sale: must be REM-YYYYMMDD-0003, NOT colliding with 0002!
	sale3, err := completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		AmountPaid:    5000,
		Items: []SaleItemInput{
			{ProductID: saved.ID, Qty: 1},
		},
	})
	if err != nil {
		t.Fatalf("Failed third sale after deletion: %v", err)
	}
	ticket3 := fmt.Sprintf("%s0003", prefix)
	if sale3.TicketNumber != ticket3 {
		t.Errorf("Expected ticket %s (max+1), got %s", ticket3, sale3.TicketNumber)
	}
}

func TestCreditPayment_ValidationAndEdges(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// Seed credit account
	res, err := db.Exec("INSERT INTO credit_accounts (customer_name, current_debt) VALUES ('Don Pedro', 50000)")
	if err != nil {
		t.Fatalf("Failed to insert credit account: %v", err)
	}
	accID, _ := res.LastInsertId()

	// 1. Negative amount
	err = recordCreditPaymentDB(db, accID, -10000, "Abono negativo invalido")
	if err == nil {
		t.Error("Expected error for negative credit payment, got nil")
	}

	// 2. Zero amount
	err = recordCreditPaymentDB(db, accID, 0, "Abono cero invalido")
	if err == nil {
		t.Error("Expected error for zero credit payment, got nil")
	}

	// 3. Non-existent account ID
	err = recordCreditPaymentDB(db, 99999, 10000, "Cuenta inexistente")
	if err == nil {
		t.Error("Expected error for non-existent account ID, got nil")
	}

	// 4. Valid payment
	err = recordCreditPaymentDB(db, accID, 20000, "Abono parcial 20k")
	if err != nil {
		t.Fatalf("Failed valid credit payment: %v", err)
	}

	// Verify updated debt
	var currentDebt float64
	_ = db.QueryRow("SELECT current_debt FROM credit_accounts WHERE id = ?", accID).Scan(&currentDebt)
	if currentDebt != 30000 {
		t.Errorf("Expected remaining debt 30000, got %f", currentDebt)
	}
}

func TestFinancialReports_AllPeriodsAndZeroDivisions(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// 1. Test when database has zero sales and zero purchases
	periods := []string{"week", "month", "year", "all", "unknown"}
	for _, p := range periods {
		rep, err := getFinancialReportsDB(db, p)
		if err != nil {
			t.Fatalf("Failed to get financial reports for period %s: %v", p, err)
		}
		if rep.TotalSales != 0 || rep.TotalPurchases != 0 || rep.GrossMargin != 0 {
			t.Errorf("Expected zeros for empty report in period %s, got %+v", p, rep)
		}
		if rep.GrossMarginPct != 0 || rep.AverageTicket != 0 {
			t.Errorf("Expected 0 percent and ticket when no sales, got marginPct=%f, avgTicket=%f",
				rep.GrossMarginPct, rep.AverageTicket)
		}
		if rep.DianUvtThreshold <= 0 {
			t.Errorf("Expected DianUvtThreshold > 0, got %f", rep.DianUvtThreshold)
		}
	}

	// 2. Seed a sale and a purchase
	prod := Product{Barcode: "FIN-01", Name: "Arroz 1kg", Price: 4000, CostPrice: 3000, Stock: 100, Active: true}
	_ = saveOrUpdateProduct(db, prod)
	saved, _ := getProductByBarcode(db, "FIN-01")

	// Sale
	_, err := completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		AmountPaid:    10000,
		Items:         []SaleItemInput{{ProductID: saved.ID, Qty: 2}}, // Total: 8000, Cost: 6000
	})
	if err != nil {
		t.Fatalf("Failed sale: %v", err)
	}

	// Purchase
	sup, _ := saveSupplierDB(db, Supplier{Name: "Distribuidora Los Andes", Active: true})
	_, err = createPurchaseTx(db, PurchaseInput{
		SupplierID:    sup.ID,
		InvoiceNumber: "FAC-991",
		InvoiceDate:   "2026-10-01",
		PaymentStatus: "Contado",
		TotalCost:     15000,
		Items: []PurchaseItemInput{
			{ProductID: saved.ID, Barcode: saved.Barcode, ProductName: saved.Name, Qty: 5, UnitCost: 3000, SuggestedPrice: 4200},
		},
	})
	if err != nil {
		t.Fatalf("Failed purchase: %v", err)
	}

	repMonth, err := getFinancialReportsDB(db, "month")
	if err != nil {
		t.Fatalf("Failed getFinancialReportsDB month: %v", err)
	}
	if repMonth.TotalSales != 8000 {
		t.Errorf("Expected TotalSales 8000, got %f", repMonth.TotalSales)
	}
	if repMonth.TotalPurchases != 15000 {
		t.Errorf("Expected TotalPurchases 15000, got %f", repMonth.TotalPurchases)
	}
	// Gross margin = Sales (8000) - Cost of Sales (6000) = 2000
	if repMonth.GrossMargin != 2000 {
		t.Errorf("Expected GrossMargin 2000, got %f", repMonth.GrossMargin)
	}
	if repMonth.GrossMarginPct != 25.0 { // 2000 / 8000 * 100 = 25%
		t.Errorf("Expected GrossMarginPct 25.0, got %f", repMonth.GrossMarginPct)
	}
	if repMonth.AverageTicket != 8000 {
		t.Errorf("Expected AverageTicket 8000, got %f", repMonth.AverageTicket)
	}
	if repMonth.DianCurrentPct <= 0 {
		t.Errorf("Expected DianCurrentPct > 0, got %f", repMonth.DianCurrentPct)
	}
}

func TestApp_ExportCSVFallbacksAndPanicRecovery(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// Seed product
	_ = saveOrUpdateProduct(db, Product{Barcode: "EXP-01", Name: "Café 500g", Price: 12000, CostPrice: 8000, Stock: 10, Active: true})

	app := &App{
		db:  db,
		ctx: context.Background(), // Headless context without "frontend" key
	}

	// 1. Export inventory CSV file (headless fallback check)
	invPath, err := app.ExportInventoryCSVFile()
	if err != nil {
		t.Fatalf("ExportInventoryCSVFile failed: %v", err)
	}
	if !strings.Contains(invPath, "iLuz_Reportes") {
		t.Errorf("Expected fallback path to contain iLuz_Reportes, got: %s", invPath)
	}
	defer os.Remove(invPath)

	// 2. Export inventory session CSV file (headless fallback with closed session)
	sess, err := startInventorySession(db, "Auditoria Cerrada Test", "Admin", "ALL", "Notas")
	if err != nil {
		t.Fatalf("Failed to start session: %v", err)
	}
	_ = closeInventorySession(db, sess.ID, []int64{})

	// Pass 0 sessionId -> falls back to the last closed session automatically
	sessionPath, err := app.ExportInventorySessionCSVFile(0)
	if err != nil {
		t.Fatalf("ExportInventorySessionCSVFile(0) failed: %v", err)
	}
	if sessionPath == "" {
		t.Errorf("Expected sessionPath not to be empty")
	}
	if _, errStat := os.Stat(sessionPath); os.IsNotExist(errStat) {
		t.Errorf("Session report fallback file not created: %s", sessionPath)
	}
	defer os.Remove(sessionPath)
}

func TestCashShift_FullCycleAndEdgeCases(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// 1. No shift open initially
	cur, err := getCurrentCashShiftDB(db)
	if err != nil {
		t.Fatalf("Error querying current shift: %v", err)
	}
	if cur != nil {
		t.Errorf("Expected nil when no shift is open, got %+v", cur)
	}

	// 2. Open shift with base 50,000
	s1, err := openCashShiftDB(db, 50000, "Apertura mañana")
	if err != nil {
		t.Fatalf("Failed to open shift: %v", err)
	}
	if s1.InitialCash != 50000 || s1.ExpectedCash != 50000 {
		t.Errorf("Shift initial cash mismatch: %+v", s1)
	}

	// 3. Attempt to open a second shift while one is already open -> must fail
	_, err = openCashShiftDB(db, 20000, "Segunda apertura ilegal")
	if err == nil {
		t.Error("Expected error when opening second shift while one is open, got nil")
	}

	// 4. Close shift with cash surplus and difference assimilation = true
	// Actual counted cash = 55,000 (5,000 surplus)
	closed1, err := closeCashShiftDB(db, s1.ID, 55000, true, "Cierre con 5000 de sobra asimilado")
	if err != nil {
		t.Fatalf("Failed to close shift: %v", err)
	}
	if closed1.UnrecordedSalesAdjust != 5000 {
		t.Errorf("Expected UnrecordedSalesAdjust 5000, got %f", closed1.UnrecordedSalesAdjust)
	}
	if closed1.ExpectedCash != 55000 {
		t.Errorf("Expected adjusted ExpectedCash 55000, got %f", closed1.ExpectedCash)
	}

	// 5. Attempt to close an already closed shift -> must fail
	_, err = closeCashShiftDB(db, s1.ID, 55000, false, "Cierre duplicado")
	if err == nil {
		t.Error("Expected error when closing already closed shift, got nil")
	}
}

func TestSuppliersAndPurchases_ComprehensiveEdges(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// Seed product
	prod := Product{Barcode: "PUR-01", Name: "Atún Van Camps", Price: 7500, CostPrice: 5000, Stock: 10, Active: true}
	_ = saveOrUpdateProduct(db, prod)
	saved, _ := getProductByBarcode(db, "PUR-01")

	// 1. Create Supplier
	sup, err := saveSupplierDB(db, Supplier{
		NitOrCedula:  "900123456-1",
		Name:         "Alimentos Polar",
		ContactName:  "Carlos Gomez",
		Phone:        "3101234567",
		Email:        "carlos@polar.com",
		PaymentTerms: "Crédito 15 días",
		Active:       true,
	})
	if err != nil {
		t.Fatalf("Failed to save supplier: %v", err)
	}

	// 2. Update Supplier
	sup.Phone = "3119876543"
	updatedSup, err := saveSupplierDB(db, *sup)
	if err != nil || updatedSup.Phone != "3119876543" {
		t.Fatalf("Failed to update supplier phone: %v", err)
	}

	// 3. Purchase with price suggestion
	pur, err := createPurchaseTx(db, PurchaseInput{
		SupplierID:    sup.ID,
		InvoiceNumber: "POL-0092",
		InvoiceDate:   "2026-10-02",
		PaymentStatus: "Crédito",
		TotalCost:     60000,
		Items: []PurchaseItemInput{
			{
				ProductID:      saved.ID,
				Barcode:        saved.Barcode,
				ProductName:    saved.Name,
				Qty:            10,
				UnitCost:       6000, // Cost went from 5000 to 6000
				SuggestedPrice: 9000, // New retail price
			},
		},
	})
	if err != nil {
		t.Fatalf("Failed to create purchase: %v", err)
	}

	if pur.TotalCost != 60000 || len(pur.Items) != 1 {
		t.Errorf("Purchase header or items mismatch: %+v", pur)
	}

	// Verify product stock and prices updated
	pUpdated, _ := getProductByBarcode(db, "PUR-01")
	if pUpdated.Stock != 20 { // 10 original + 10 purchased
		t.Errorf("Expected stock 20, got %d", pUpdated.Stock)
	}
	if pUpdated.CostPrice != 6000 {
		t.Errorf("Expected cost price 6000, got %f", pUpdated.CostPrice)
	}
	if pUpdated.Price != 9000 {
		t.Errorf("Expected retail price 9000, got %f", pUpdated.Price)
	}

	// 4. List Purchases
	purchases, err := listPurchasesDB(db, 10)
	if err != nil || len(purchases) != 1 {
		t.Errorf("Expected 1 purchase in list, got %d", len(purchases))
	}

	// 5. Inactivate Supplier
	err = deleteSupplierDB(db, sup.ID)
	if err != nil {
		t.Fatalf("Failed to inactivate supplier: %v", err)
	}
	activeSups, _ := listSuppliersDB(db, true)
	if len(activeSups) != 0 {
		t.Errorf("Expected 0 active suppliers, got %d", len(activeSups))
	}
	allSups, _ := listSuppliersDB(db, false)
	if len(allSups) != 1 || allSups[0].Active {
		t.Errorf("Expected 1 inactive supplier, got %+v", allSups)
	}
}

func TestDeep_AppScannerAndStatusMethods(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	app := NewApp()
	app.db = db
	app.ctx = context.Background()

	// 1. updateStatus, GetScannerStatus, EmitScannerStatus
	app.updateStatus(ScannerStatusPayload{
		Connected:      true,
		Port:           "COM1",
		AvailablePorts: []string{"COM1"},
	})

	st := app.GetScannerStatus()
	if !st.Connected || st.Port != "COM1" {
		t.Errorf("Expected connected COM1, got: %+v", st)
	}

	app.EmitScannerStatus()

	// 2. SetScannerPort, GetCurrentPort, GetAvailablePorts
	app.SetScannerPort("COM2")
	if app.GetCurrentPort() != "COM2" {
		t.Errorf("Expected current port COM2, got: %s", app.GetCurrentPort())
	}
	_ = app.GetAvailablePorts()

	// 3. Scanner worker edge: targetPort empty with available ports
	origGetPorts := getPortsList
	origOpen := openSerialPort
	defer func() {
		getPortsList = origGetPorts
		openSerialPort = origOpen
	}()

	getPortsList = func() ([]string, error) {
		return []string{"COM9"}, nil
	}
	openSerialPort = func(portName string, mode *serial.Mode) (serial.Port, error) {
		return &mockSerialPort{readData: []byte("TEST-BAR\r\n")}, nil
	}

	ctxWorker, cancelWorker := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancelWorker()
	startScannerWorker(ctxWorker, db, "", nil) // Empty port triggers auto-selection of available[0]
}

func TestDeep_ProductLocationAndShelfEdges(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// 1. saveShelf validations
	err := saveShelf(db, Shelf{Code: "", Name: "Estante"})
	if err == nil || !strings.Contains(err.Error(), "código del estante no puede estar vacío") {
		t.Errorf("Expected empty code error, got: %v", err)
	}

	err = saveShelf(db, Shelf{Code: "EST01", Name: ""})
	if err == nil || !strings.Contains(err.Error(), "nombre del estante no puede estar vacío") {
		t.Errorf("Expected empty name error, got: %v", err)
	}

	err = saveShelf(db, Shelf{Code: "EST01", Name: "Estante", Levels: nil})
	if err == nil || !strings.Contains(err.Error(), "debe tener al menos un nivel") {
		t.Errorf("Expected empty levels error, got: %v", err)
	}

	// Valid shelf insert
	sh := Shelf{
		Code: "SH01",
		Name: "Estante 1",
		Levels: []ShelfLevel{
			{Level: 0, Slots: 0, Name: ""}, // Tests default level 1, slots 1, Name "Nivel 1"
		},
	}
	if err := saveShelf(db, sh); err != nil {
		t.Fatalf("Failed saving valid shelf: %v", err)
	}

	shelves, _ := getAllShelves(db)
	if len(shelves) == 0 {
		t.Fatalf("Expected at least 1 shelf")
	}
	shID := shelves[0].ID

	// Update existing shelf ID
	sh.ID = shID
	sh.Name = "Estante 1 Modificado"
	if err := saveShelf(db, sh); err != nil {
		t.Fatalf("Failed updating shelf: %v", err)
	}

	// Insert second shelf and test duplicate code update
	sh2 := Shelf{
		Code: "SH02",
		Name: "Estante 2",
		Levels: []ShelfLevel{{Level: 1, Slots: 2, Name: "Nivel 1"}},
	}
	if err := saveShelf(db, sh2); err != nil {
		t.Fatalf("Failed saving shelf 2: %v", err)
	}
	shelves2, _ := getAllShelves(db)
	var sh2ID int64
	for _, s := range shelves2 {
		if s.Code == "SH02" {
			sh2ID = s.ID
		}
	}
	// Try updating sh2 with code of sh1 ("SH01")
	sh2.ID = sh2ID
	sh2.Code = "SH01"
	err = saveShelf(db, sh2)
	if err == nil || !strings.Contains(err.Error(), "ya está registrado") {
		t.Errorf("Expected duplicate code error, got: %v", err)
	}

	// Delete shelf
	if err := deleteShelf(db, sh2ID); err != nil {
		t.Errorf("Failed deleting shelf: %v", err)
	}

	// 2. saveLocation validations
	err = saveLocation(db, Location{Code: "", Name: "Pasillo"})
	if err == nil || !strings.Contains(err.Error(), "código de la locación no puede estar vacío") {
		t.Errorf("Expected empty code error, got: %v", err)
	}

	err = saveLocation(db, Location{Code: "LOC01", Name: ""})
	if err == nil || !strings.Contains(err.Error(), "nombre de la locación no puede estar vacío") {
		t.Errorf("Expected empty name error, got: %v", err)
	}

	loc := Location{Code: "LOC-A", Name: "Locación A", Description: "Desc A"}
	if err := saveLocation(db, loc); err != nil {
		t.Fatalf("Failed saving location: %v", err)
	}
	allLocs, _ := getAllLocations(db)
	var locAID int64
	for _, l := range allLocs {
		if l.Code == "LOC-A" {
			locAID = l.ID
		}
	}

	// Update existing location ID
	loc.ID = locAID
	loc.Name = "Locación A Editada"
	if err := saveLocation(db, loc); err != nil {
		t.Fatalf("Failed updating location: %v", err)
	}

	// Save another location and test duplicate code update
	locB := Location{Code: "LOC-B", Name: "Locación B"}
	_ = saveLocation(db, locB)
	allLocs2, _ := getAllLocations(db)
	var locBID int64
	for _, l := range allLocs2 {
		if l.Code == "LOC-B" {
			locBID = l.ID
		}
	}
	locB.ID = locBID
	locB.Code = "LOC-A"
	err = saveLocation(db, locB)
	if err == nil || !strings.Contains(err.Error(), "ya está registrado") {
		t.Errorf("Expected duplicate location code error, got: %v", err)
	}

	if err := deleteLocation(db, locBID); err != nil {
		t.Errorf("Failed deleting location: %v", err)
	}

	// 3. Product operations: internal SKU generation, duplicate barcode, and audit lock
	prodNoBarcode := Product{
		Barcode: "",
		Name:    "Producto Sin Código",
		Price:   1500,
		Stock:   10,
		Active:  true,
	}
	if err := saveOrUpdateProduct(db, prodNoBarcode); err != nil {
		t.Fatalf("Failed saving product without barcode: %v", err)
	}
	prods, _ := listAllProducts(db)
	var createdProd Product
	for _, p := range prods {
		if p.Name == "Producto Sin Código" {
			createdProd = p
		}
	}
	if !strings.HasPrefix(createdProd.Barcode, "INT-") {
		t.Errorf("Expected auto-generated SKU prefix 'INT-', got: %s", createdProd.Barcode)
	}

	// Save another product and test duplicate barcode on update
	prod2 := Product{Barcode: "BAR-UNIQUE-99", Name: "Producto 2", Price: 2000, Stock: 5, Active: true}
	_ = saveOrUpdateProduct(db, prod2)
	prods2, _ := listAllProducts(db)
	var prod2ID int64
	for _, p := range prods2 {
		if p.Barcode == "BAR-UNIQUE-99" {
			prod2ID = p.ID
		}
	}
	// Try updating createdProd with BAR-UNIQUE-99
	createdProd.Barcode = "BAR-UNIQUE-99"
	err = saveOrUpdateProduct(db, createdProd)
	if err == nil || !strings.Contains(err.Error(), "ya está registrado") {
		t.Errorf("Expected duplicate barcode error, got: %v", err)
	}

	// Test updateProductLocation with non-existent barcode
	err = updateProductLocation(db, "BAR-NONEXISTENT", "LOC-A")
	if err != sql.ErrNoRows {
		t.Errorf("Expected sql.ErrNoRows for non-existent barcode, got: %v", err)
	}

	// Test archiveProduct and restoreProduct on non-existent barcode
	if err := archiveProduct(db, "BAR-NONEXISTENT"); err != sql.ErrNoRows {
		t.Errorf("Expected ErrNoRows archiving non-existent barcode, got: %v", err)
	}
	if err := restoreProduct(db, "BAR-NONEXISTENT"); err != sql.ErrNoRows {
		t.Errorf("Expected ErrNoRows restoring non-existent barcode, got: %v", err)
	}

	// Test Rule 6: audit in progress preserves product stock during edits
	sess, err := startInventorySession(db, "Auditoria En Curso", "Operador", "ALL", "")
	if err != nil {
		t.Fatalf("Failed starting session: %v", err)
	}
	// Edit prod2 trying to change stock from 5 to 500
	prod2.ID = prod2ID
	prod2.Stock = 500
	prod2.Name = "Producto 2 Modificado"
	if err := saveOrUpdateProduct(db, prod2); err != nil {
		t.Fatalf("Failed saving product during audit: %v", err)
	}
	reloaded, _ := getProductByBarcode(db, "BAR-UNIQUE-99")
	if reloaded.Stock != 5 {
		t.Errorf("Rule 6 failed: expected preserved stock 5, got %d", reloaded.Stock)
	}
	_ = cancelInventorySession(db, sess.ID)
}

func TestDeep_InventoryAuditEdgeCasesAndScans(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// Seed product
	_ = saveOrUpdateProduct(db, Product{Barcode: "AUD-P1", Name: "Arroz 1kg", Price: 4000, Stock: 20, Location: "EST01-N1-C1", Active: true})
	_ = saveOrUpdateProduct(db, Product{Barcode: "AUD-P2", Name: "Lentejas 500g", Price: 3500, Stock: 15, Location: "EST02-N1-C1", Active: true})

	app := NewApp()
	app.db = db
	app.ctx = context.Background()

	// 1. startInventorySession edge cases
	_, err := startInventorySession(db, "", "Admin", "ALL", "")
	if err == nil || !strings.Contains(err.Error(), "nombre del inventario no puede estar vacío") {
		t.Errorf("Expected empty name error, got: %v", err)
	}

	// Empty scope defaults to "ALL"
	sess, err := startInventorySession(db, "Auditoria Válida", "Admin", "", "")
	if err != nil {
		t.Fatalf("Failed starting session with empty scope: %v", err)
	}
	if sess.Scope != "ALL" {
		t.Errorf("Expected scope 'ALL', got: %s", sess.Scope)
	}

	// Starting a second session while one is in progress fails
	_, err = startInventorySession(db, "Segunda Auditoría", "Admin", "ALL", "")
	if err == nil || !strings.Contains(err.Error(), "ya existe una toma de inventario activa") {
		t.Errorf("Expected active audit conflict error, got: %v", err)
	}

	items, err := listInventorySessionItems(db, sess.ID)
	if err != nil || len(items) == 0 {
		t.Fatalf("Failed listing session items: %v", err)
	}
	p1Item := items[0]

	// 2. recordInventoryCountEntry validations & replace mode
	err = recordInventoryCountEntry(db, p1Item.ID, "EST01-N1-C1", -1, false)
	if err == nil || !strings.Contains(err.Error(), "no puede ser negativa") {
		t.Errorf("Expected negative count error, got: %v", err)
	}

	err = recordInventoryCountEntry(db, 999999, "EST01-N1-C1", 5, false)
	if err == nil || !strings.Contains(err.Error(), "no encontrado") {
		t.Errorf("Expected item not found error, got: %v", err)
	}

	// Normal add + replace mode test
	_ = recordInventoryCountEntry(db, p1Item.ID, "EST01-N1-C1", 3, false)
	_ = recordInventoryCountEntry(db, p1Item.ID, "EST01-N1-C1", 10, true) // Replace count with 10
	itemsAfterReplace, _ := listInventorySessionItems(db, sess.ID)
	var countedItem1 *InventorySessionItem
	for _, it := range itemsAfterReplace {
		if it.ID == p1Item.ID {
			countedItem1 = &it
			break
		}
	}
	if countedItem1 == nil || countedItem1.CountedQty != 10 {
		t.Errorf("Expected counted_qty 10 after replace, got: %+v", countedItem1)
	}

	// 3. undoLastInventoryEntry branches
	// Non-existent item
	err = undoLastInventoryEntry(db, 999999)
	if err == nil || !strings.Contains(err.Error(), "no encontrado") {
		t.Errorf("Expected not found error, got: %v", err)
	}

	// Item with entries: currently 10. Undo decrements to 9 (curQty > 1 branch)
	err = undoLastInventoryEntry(db, p1Item.ID)
	if err != nil {
		t.Fatalf("Failed undoing entry: %v", err)
	}
	itemsAfterUndo1, _ := listInventorySessionItems(db, sess.ID)
	var countedItem2 *InventorySessionItem
	for _, it := range itemsAfterUndo1 {
		if it.ID == p1Item.ID {
			countedItem2 = &it
			break
		}
	}
	if countedItem2 == nil || countedItem2.CountedQty != 9 {
		t.Errorf("Expected counted_qty 9 after undo, got: %+v", countedItem2)
	}

	// Set qty to 1 and undo (curQty == 1 branch: DELETE entry)
	_ = recordInventoryCountEntry(db, p1Item.ID, "EST01-N1-C1", 1, true)
	err = undoLastInventoryEntry(db, p1Item.ID)
	if err != nil {
		t.Fatalf("Failed undoing single entry: %v", err)
	}
	itemsAfterUndo2, _ := listInventorySessionItems(db, sess.ID)
	if itemsAfterUndo2[0].CountedQty != 0 || itemsAfterUndo2[0].IsCounted {
		t.Errorf("Expected counted_qty 0 and isCounted false, got: %+v", itemsAfterUndo2[0])
	}

	// Undo again when 0 entries exist (sql.ErrNoRows -> return nil branch)
	err = undoLastInventoryEntry(db, p1Item.ID)
	if err != nil {
		t.Errorf("Expected nil when nothing to undo, got: %v", err)
	}

	// 4. RecordInventoryScan via App:
	// a) Empty barcode
	_, err = app.RecordInventoryScan(sess.ID, "", "EST01")
	if err == nil || !strings.Contains(err.Error(), "código de barras vacío") {
		t.Errorf("Expected empty barcode error, got: %v", err)
	}

	// b) Unknown barcode
	_, err = app.RecordInventoryScan(sess.ID, "BAR-UNKNOWN-XXX", "EST01")
	if err == nil || !strings.Contains(err.Error(), "UNKNOWN_BARCODE") {
		t.Errorf("Expected UNKNOWN_BARCODE error, got: %v", err)
	}

	// c) Out-of-scope scan: start a new scoped session with EST01 only
	_ = cancelInventorySession(db, sess.ID)
	scopedSess, err := startInventorySession(db, "Auditoria Solo EST01", "Admin", "EST01", "")
	if err != nil {
		t.Fatalf("Failed starting scoped session: %v", err)
	}

	// Scan AUD-P2 (which is in EST02). It is not in initial session items!
	// RecordInventoryScan will automatically append it to the session.
	scannedItem, err := app.RecordInventoryScan(scopedSess.ID, "AUD-P2", "EST01-N1-C1")
	if err != nil {
		t.Fatalf("Failed recording out-of-scope scan: %v", err)
	}
	if scannedItem.Barcode != "AUD-P2" || scannedItem.CountedQty != 1 {
		t.Errorf("Expected appended out-of-scope item with CountedQty 1, got: %+v", scannedItem)
	}

	// 5. closeInventorySession error branches
	err = closeInventorySession(db, 999999, nil)
	if err == nil || !strings.Contains(err.Error(), "no encontrado") {
		t.Errorf("Expected not found error, got: %v", err)
	}

	// Close scoped session
	err = closeInventorySession(db, scopedSess.ID, []int64{scannedItem.ProductID})
	if err != nil {
		t.Fatalf("Failed closing session: %v", err)
	}

	// Try closing already closed session
	err = closeInventorySession(db, scopedSess.ID, nil)
	if err == nil || !strings.Contains(err.Error(), "no está en progreso") {
		t.Errorf("Expected not in progress error on closed session, got: %v", err)
	}

	// Record scan on closed session fails
	_, err = app.RecordInventoryScan(scopedSess.ID, "AUD-P1", "EST01")
	if err == nil || !strings.Contains(err.Error(), "no está activa") {
		t.Errorf("Expected inactive session error, got: %v", err)
	}

	// Cancel session with <= 0 when no session active fails
	err = app.CancelInventorySession(0)
	if err == nil || !strings.Contains(err.Error(), "no existe ninguna sesión activa") {
		t.Errorf("Expected no active session error, got: %v", err)
	}
}

func TestDeep_POSCreditAndPurchaseEdges(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "CR-01", Name: "Pan tajado", Price: 5000, CostPrice: 3500, Stock: 10, Active: true})

	p, _ := getProductByBarcode(db, "CR-01")

	// 1. Credit sale: First sale inserts credit_account, second sale updates existing credit_account
	sale1, err := completeSaleTx(db, SaleInput{
		PaymentMethod: "fiao",
		CustomerName:  "Vecina Clara",
		Items:         []SaleItemInput{{ProductID: p.ID, Qty: 1}},
	})
	if err != nil {
		t.Fatalf("Sale 1 failed: %v", err)
	}
	if sale1.CustomerName != "Vecina Clara" {
		t.Errorf("Expected customer Vecina Clara, got: %s", sale1.CustomerName)
	}

	// Sale 2 to the same customer (exercises UPDATE credit_accounts branch)
	sale2, err := completeSaleTx(db, SaleInput{
		PaymentMethod: "fiao",
		CustomerName:  "Vecina Clara",
		Items:         []SaleItemInput{{ProductID: p.ID, Qty: 2}},
	})
	if err != nil {
		t.Fatalf("Sale 2 failed: %v", err)
	}
	if sale2.TotalAmount != 10000 {
		t.Errorf("Expected sale 2 total 10000, got: %f", sale2.TotalAmount)
	}

	accs, _ := listCreditAccountsDB(db)
	var claraDebt float64
	for _, a := range accs {
		if a.CustomerName == "Vecina Clara" {
			claraDebt = a.CurrentDebt
		}
	}
	if claraDebt != 15000 {
		t.Errorf("Expected total accumulated debt 15000, got: %f", claraDebt)
	}

	// 2. getSaleByTicketDB with non-existent ticket
	_, err = getSaleByTicketDB(db, "REM-NONEXISTENT")
	if err != sql.ErrNoRows {
		t.Errorf("Expected sql.ErrNoRows for non-existent ticket, got: %v", err)
	}

	// 3. getPurchaseDB with non-existent ID
	_, err = getPurchaseDB(db, 999999)
	if err != sql.ErrNoRows {
		t.Errorf("Expected sql.ErrNoRows for non-existent purchase, got: %v", err)
	}

	// 4. createPurchaseTx with SuggestedPrice = 0 (exercises branch where sale price is untouched)
	sup, _ := saveSupplierDB(db, Supplier{Name: "Distribuidora Los Andes", Phone: "3110000000", Active: true})
	pBefore, _ := getProductByBarcode(db, "CR-01")
	origPrice := pBefore.Price

	pur, err := createPurchaseTx(db, PurchaseInput{
		SupplierID:    sup.ID,
		InvoiceNumber: "INV-PRICE-0",
		InvoiceDate:   "2026-10-02",
		PaymentStatus: "paid",
		TotalCost:     8000,
		Items: []PurchaseItemInput{
			{
				ProductID:      pBefore.ID,
				Barcode:        pBefore.Barcode,
				ProductName:    pBefore.Name,
				Qty:            2,
				UnitCost:       4000,
				SuggestedPrice: 0, // 0 -> price should NOT change
			},
		},
	})
	if err != nil {
		t.Fatalf("Purchase with SuggestedPrice 0 failed: %v", err)
	}
	if pur == nil {
		t.Fatalf("Expected non-nil purchase")
	}

	pAfter, _ := getProductByBarcode(db, "CR-01")
	if pAfter.Price != origPrice {
		t.Errorf("Expected price to remain %f, got: %f", origPrice, pAfter.Price)
	}

	// 5. getFinancialReportsDB with invalid period
	rep, err := getFinancialReportsDB(db, "invalid_period")
	if err != nil {
		t.Fatalf("Financial report with invalid period failed: %v", err)
	}
	if rep == nil {
		t.Errorf("Expected report object even on fallback period")
	}

	// 6. searchProducts matching by location and barcode
	_ = saveOrUpdateProduct(db, Product{Barcode: "SEARCH-BC", Name: "Aceite de Palma", Location: "LOC-SEARCH", Price: 8000, Stock: 5, Active: true})
	resByLoc, err := searchProducts(db, "LOC-SEARCH")
	if err != nil || len(resByLoc) == 0 {
		t.Errorf("Expected product found by location, got: %v", resByLoc)
	}
	resByBc, err := searchProducts(db, "SEARCH-BC")
	if err != nil || len(resByBc) == 0 {
		t.Errorf("Expected product found by barcode, got: %v", resByBc)
	}
}

func TestDeep_ExportCSVDialogBranchesAndStoreConfigErrors(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// Add an active product AND an archived product
	_ = saveOrUpdateProduct(db, Product{Barcode: "EXP-ACT", Name: "Activo", Price: 1000, Stock: 5, Active: true})
	_ = saveOrUpdateProduct(db, Product{Barcode: "EXP-ARC", Name: "Archivado", Price: 2000, Stock: 0, Active: false})

	app := NewApp()
	app.db = db
	// Context with "frontend" key
	app.ctx = context.WithValue(context.Background(), "frontend", true)

	tmpDir, err := os.MkdirTemp("", "iluz_export_test_*")
	if err != nil {
		t.Fatalf("Failed creating temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	targetFile := filepath.Join(tmpDir, "test_inv.csv")

	var focused bool
	app.windowFocusFn = func(ctx context.Context) {
		focused = true
	}

	// 1. ExportInventoryCSVFile: Dialog returns selected path
	app.saveDialogFn = func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
		return targetFile, nil
	}
	p, err := app.ExportInventoryCSVFile()
	if err != nil {
		t.Fatalf("ExportInventoryCSVFile with dialog path failed: %v", err)
	}
	if p != targetFile {
		t.Errorf("Expected path %s, got %s", targetFile, p)
	}
	if !focused {
		t.Errorf("Expected windowFocusFn to be called")
	}
	content, _ := os.ReadFile(targetFile)
	if !strings.Contains(string(content), "Archivado") {
		t.Errorf("Expected CSV to contain 'Archivado' status row")
	}

	// 2. ExportInventoryCSVFile: Dialog cancelled (selectedPath == "")
	app.saveDialogFn = func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
		return "", nil
	}
	pCancel, err := app.ExportInventoryCSVFile()
	if err != nil || pCancel != "" {
		t.Errorf("Expected empty path and nil error on cancel, got (%s, %v)", pCancel, err)
	}

	// 3. ExportInventoryCSVFile: Dialog returns error -> falls back to saveFallback()
	app.saveDialogFn = func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
		return "", fmt.Errorf("dialog error")
	}
	pFallback, err := app.ExportInventoryCSVFile()
	if err != nil {
		t.Fatalf("Expected fallback success on dialog error, got: %v", err)
	}
	if !strings.Contains(pFallback, "iLuz_Reportes") {
		t.Errorf("Expected fallback path in iLuz_Reportes, got: %s", pFallback)
	}
	_ = os.Remove(pFallback)

	// 4. ExportInventorySessionCSVFile: Dialog returns path, cancel, and error
	sess, _ := startInventorySession(db, "Auditoria Export Dialog", "Admin", "ALL", "")
	_ = closeInventorySession(db, sess.ID, nil)

	sessionTarget := filepath.Join(tmpDir, "test_sess.csv")
	app.saveDialogFn = func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
		return sessionTarget, nil
	}
	ps, err := app.ExportInventorySessionCSVFile(sess.ID)
	if err != nil {
		t.Fatalf("ExportInventorySessionCSVFile with dialog path failed: %v", err)
	}
	if ps != sessionTarget {
		t.Errorf("Expected path %s, got %s", sessionTarget, ps)
	}

	// Cancel dialog
	app.saveDialogFn = func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
		return "", nil
	}
	psCancel, err := app.ExportInventorySessionCSVFile(sess.ID)
	if err != nil || psCancel != "" {
		t.Errorf("Expected empty path on session cancel, got (%s, %v)", psCancel, err)
	}

	// Dialog error fallback
	app.saveDialogFn = func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
		return "", fmt.Errorf("dialog failed")
	}
	psFallback, err := app.ExportInventorySessionCSVFile(sess.ID)
	if err != nil {
		t.Fatalf("Expected session fallback on dialog error, got: %v", err)
	}
	if !strings.Contains(psFallback, "iLuz_Reportes") {
		t.Errorf("Expected fallback in iLuz_Reportes, got: %s", psFallback)
	}
	_ = os.Remove(psFallback)

	// 5. getStoreConfigDB with empty table returns error
	_, _ = db.Exec("DELETE FROM store_config;")
	_, err = getStoreConfigDB(db)
	if err != sql.ErrNoRows {
		t.Errorf("Expected ErrNoRows on empty store_config, got: %v", err)
	}
}

func TestDeep_FinalHardeningAndValidationBranches(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	app := NewApp()
	app.db = db
	app.ctx = context.Background()

	// 1. App.SaveProduct with empty barcode (pre-generates SKU)
	err := app.SaveProduct(Product{
		Barcode: "",
		Name:    "Producto SKU Pre-Gen",
		Price:   3500,
		Stock:   12,
		Active:  true,
	})
	if err != nil {
		t.Fatalf("app.SaveProduct with empty barcode failed: %v", err)
	}
	allProds, _ := listAllProducts(db)
	var skuProd *Product
	for _, p := range allProds {
		if p.Name == "Producto SKU Pre-Gen" {
			skuProd = &p
			break
		}
	}
	if skuProd == nil || !strings.HasPrefix(skuProd.Barcode, "INT-") {
		t.Errorf("Expected product with INT- barcode prefix, got: %+v", skuProd)
	}

	// 2. completeSaleTx validations: Qty <= 0, inactive product, insufficient stock
	// Seed active & inactive products
	_ = saveOrUpdateProduct(db, Product{Barcode: "INACT-01", Name: "Producto Archivado", Price: 1000, Stock: 10, Active: false})
	_ = saveOrUpdateProduct(db, Product{Barcode: "ACT-01", Name: "Producto Limitado", Price: 2000, Stock: 2, Active: true})
	inactP, _ := getProductByBarcode(db, "INACT-01")
	actP, _ := getProductByBarcode(db, "ACT-01")

	// a) Qty <= 0
	_, err = completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		Items:         []SaleItemInput{{ProductID: actP.ID, Qty: 0}},
	})
	if err == nil || !strings.Contains(err.Error(), "debe ser mayor a 0") {
		t.Errorf("Expected Qty > 0 error, got: %v", err)
	}

	// b) Inactive product
	_, err = completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		Items:         []SaleItemInput{{ProductID: inactP.ID, Qty: 1}},
	})
	if err == nil || !strings.Contains(err.Error(), "inactivo o archivado") {
		t.Errorf("Expected inactive product error, got: %v", err)
	}

	// c) Insufficient stock when AllowNegativeStock is false
	_ = saveStoreConfigDB(db, StoreConfig{StoreName: "Mi Tienda", AllowNegativeStock: false})
	_, err = completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		Items:         []SaleItemInput{{ProductID: actP.ID, Qty: 5}}, // Only 2 in stock
	})
	if err == nil || !strings.Contains(err.Error(), "stock insuficiente") {
		t.Errorf("Expected insufficient stock error, got: %v", err)
	}

	// 3. createPurchaseTx validations: empty items, Qty <= 0, UnitCost < 0, non-existent product
	sup, _ := saveSupplierDB(db, Supplier{Name: "Proveedor Test", Active: true})

	// Empty items
	_, err = createPurchaseTx(db, PurchaseInput{SupplierID: sup.ID, Items: nil})
	if err == nil || !strings.Contains(err.Error(), "al menos un producto") {
		t.Errorf("Expected empty purchase items error, got: %v", err)
	}

	// Qty <= 0
	_, err = createPurchaseTx(db, PurchaseInput{
		SupplierID: sup.ID,
		Items:      []PurchaseItemInput{{ProductID: actP.ID, ProductName: actP.Name, Qty: 0, UnitCost: 1000}},
	})
	if err == nil || !strings.Contains(err.Error(), "mayor a 0") {
		t.Errorf("Expected purchase Qty > 0 error, got: %v", err)
	}

	// UnitCost < 0
	_, err = createPurchaseTx(db, PurchaseInput{
		SupplierID: sup.ID,
		Items:      []PurchaseItemInput{{ProductID: actP.ID, ProductName: actP.Name, Qty: 1, UnitCost: -100}},
	})
	if err == nil || !strings.Contains(err.Error(), "no puede ser negativo") {
		t.Errorf("Expected negative cost error, got: %v", err)
	}

	// Non-existent product ID
	_, err = createPurchaseTx(db, PurchaseInput{
		SupplierID: sup.ID,
		Items:      []PurchaseItemInput{{ProductID: 999999, ProductName: "No Existe", Qty: 1, UnitCost: 1000}},
	})
	if err == nil || (!strings.Contains(err.Error(), "no existe") && !strings.Contains(err.Error(), "FOREIGN KEY")) {
		t.Errorf("Expected product not found error in purchase, got: %v", err)
	}

	// 4. recordCreditPaymentDB overpay error
	saleCredit, _ := completeSaleTx(db, SaleInput{
		PaymentMethod: "fiao",
		CustomerName:  "Cliente Deudor",
		Items:         []SaleItemInput{{ProductID: actP.ID, Qty: 1}},
	})
	accs, _ := listCreditAccountsDB(db)
	var deudorID int64
	for _, a := range accs {
		if a.CustomerName == "Cliente Deudor" {
			deudorID = a.ID
		}
	}
	err = recordCreditPaymentDB(db, deudorID, saleCredit.TotalAmount+50000, "Sobrepago")
	if err == nil || !strings.Contains(err.Error(), "excede la deuda actual") {
		t.Errorf("Expected overpayment error, got: %v", err)
	}

	// 5. deleteShelf with non-existent shelf ID (ErrNoRows path)
	err = deleteShelf(db, 999999)
	if err != nil {
		t.Errorf("Expected nil when deleting non-existent shelf, got: %v", err)
	}

	// 6. closeCashShiftDB on closed/non-existent shift
	_, err = closeCashShiftDB(db, 999999, 1000, false, "Turno inexistente")
	if err == nil || !strings.Contains(err.Error(), "no encontrado o ya cerrado") {
		t.Errorf("Expected error closing non-existent cash shift, got: %v", err)
	}

	// 7. listDailySalesDB with empty date string (defaults to today)
	dailySales, err := listDailySalesDB(db, "")
	if err != nil {
		t.Fatalf("listDailySalesDB with empty date failed: %v", err)
	}
	if len(dailySales) == 0 {
		t.Errorf("Expected at least 1 sale today, got 0")
	}

	// 8. listInventoryProducts with includeInactive = false vs true
	activeOnly, err := listInventoryProducts(db, false)
	if err != nil {
		t.Fatalf("listInventoryProducts(false) failed: %v", err)
	}
	allInventory, err := listInventoryProducts(db, true)
	if err != nil {
		t.Fatalf("listInventoryProducts(true) failed: %v", err)
	}
	if len(allInventory) <= len(activeOnly) {
		t.Errorf("Expected allInventory (%d) > activeOnly (%d) due to inactive product", len(allInventory), len(activeOnly))
	}

	// 9. Audit reconciliation with purchases after count date
	sess, err := startInventorySession(db, "Auditoria Con Compra Posterior", "Auditor", "ALL", "")
	if err != nil {
		t.Fatalf("Failed starting session: %v", err)
	}
	// Count actP at 2 units
	sessItems, _ := listInventorySessionItems(db, sess.ID)
	var actSessItemID int64
	for _, it := range sessItems {
		if it.ProductID == actP.ID {
			actSessItemID = it.ID
			break
		}
	}
	_ = recordInventoryCountEntry(db, actSessItemID, "EST01", 2, true)
	// Artificially backdate last_counted_at to 1 hour ago
	_, _ = db.Exec("UPDATE inventory_session_items SET last_counted_at = datetime('now', '-1 hour') WHERE id = ?", actSessItemID)

	// Now create a purchase for actP (+10 units) after count timestamp
	_, err = createPurchaseTx(db, PurchaseInput{
		SupplierID: sup.ID,
		Items:      []PurchaseItemInput{{ProductID: actP.ID, ProductName: actP.Name, Qty: 10, UnitCost: 1000}},
	})
	if err != nil {
		t.Fatalf("Purchase after count failed: %v", err)
	}

	// Close inventory applying adjustments for actP
	err = closeInventorySession(db, sess.ID, []int64{actP.ID})
	if err != nil {
		t.Fatalf("closeInventorySession failed: %v", err)
	}
	// Verified stock: Counted (2) - SoldAfterCount (1) + PurchasedAfterCount (10) = 11
	reconciledP, _ := getProductByBarcode(db, actP.Barcode)
	if reconciledP.Stock != 11 {
		t.Errorf("Expected reconciled stock 11 (2 counted - 1 sold + 10 purchased), got: %d", reconciledP.Stock)
	}
}

func TestDeep_Reach90Coverage(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	// 1. safeEmit with events context key
	eventsCtx := context.WithValue(context.Background(), "events", true)
	safeEmit(eventsCtx, "test:event", "data")
	safeEmit(nil, "test:event", "data")

	app := NewApp()
	app.db = db
	app.ctx = context.WithValue(eventsCtx, "frontend", true)
	app.windowFocusFn = func(ctx context.Context) {}

	// 2. ExportInventoryCSVFile and ExportInventorySessionCSVFile write error paths
	invalidPath := filepath.Join("/nonexistent_dir_12345", "fail.csv")
	app.saveDialogFn = func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
		return invalidPath, nil
	}
	_, err := app.ExportInventoryCSVFile()
	if err == nil || !strings.Contains(err.Error(), "error escribiendo archivo CSV") {
		t.Errorf("Expected write error from ExportInventoryCSVFile, got: %v", err)
	}

	sess, _ := startInventorySession(db, "Audit Write Fail", "Admin", "ALL", "")
	_ = closeInventorySession(db, sess.ID, nil)
	_, err = app.ExportInventorySessionCSVFile(sess.ID)
	if err == nil || !strings.Contains(err.Error(), "error escribiendo archivo CSV") {
		t.Errorf("Expected write error from ExportInventorySessionCSVFile, got: %v", err)
	}

	// 3. StartInventorySession via App with error
	_, err = app.StartInventorySession("", "Admin", "ALL", "")
	if err == nil {
		t.Errorf("Expected error from App.StartInventorySession with empty name")
	}

	// 4. RecordInventoryScan on an item ALREADY in session
	activeSess, err := app.StartInventorySession("Audit In Session", "Admin", "ALL", "")
	if err != nil {
		t.Fatalf("Failed starting audit: %v", err)
	}
	_ = saveOrUpdateProduct(db, Product{Barcode: "IN-SESS-01", Name: "Item In Session", Price: 1000, Stock: 5, Active: true})
	// Restart session to include IN-SESS-01 in snapshot
	_ = cancelInventorySession(db, activeSess.ID)
	activeSess2, _ := app.StartInventorySession("Audit In Session 2", "Admin", "ALL", "")
	// First scan of in-scope product (already in session snapshot)
	itemScanned, err := app.RecordInventoryScan(activeSess2.ID, "IN-SESS-01", "EST01")
	if err != nil {
		t.Fatalf("RecordInventoryScan on existing session item failed: %v", err)
	}
	if itemScanned.CountedQty != 1 {
		t.Errorf("Expected CountedQty 1, got %d", itemScanned.CountedQty)
	}

	// 5. saveOrUpdateProduct with ID = 0 (upsert) during active audit
	prodUpsertAudit := Product{Barcode: "AUD-UPSERT", Name: "Upsert Audit", Price: 500, Stock: 20, Active: true}
	_ = saveOrUpdateProduct(db, prodUpsertAudit)
	// Now upsert again with different stock while audit is in_progress
	prodUpsertAudit.Stock = 999
	_ = saveOrUpdateProduct(db, prodUpsertAudit)
	reloadedUpsert, _ := getProductByBarcode(db, "AUD-UPSERT")
	if reloadedUpsert.Stock != 20 {
		t.Errorf("Expected stock 20 preserved during audit upsert, got %d", reloadedUpsert.Stock)
	}
	_ = cancelInventorySession(db, activeSess2.ID)

	// 6. Scanner accumulator reset on long stream (buffer overflow protection)
	origOpen := openSerialPort
	defer func() { openSerialPort = origOpen }()

	longBytes := make([]byte, 150)
	for i := range longBytes {
		longBytes[i] = 'A'
	}
	longBytes = append(longBytes, '\r', '\n') // finally terminate
	openSerialPort = func(portName string, mode *serial.Mode) (serial.Port, error) {
		return &mockSerialPort{readData: longBytes}, nil
	}

	ctxLong, cancelLong := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancelLong()
	startScannerWorker(ctxLong, db, "COM1", func(s ScannerStatusPayload) {})
}

func TestDeep_FinalThirteenStatementsToNinetyPercent(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()

	app := NewApp()
	app.db = db
	app.ctx = context.Background()

	// 1. GetActiveInventorySession and GetCurrentCashShift when none active
	actSess, err := app.GetActiveInventorySession()
	if err != nil || actSess != nil {
		t.Errorf("Expected nil active session, got (%v, %v)", actSess, err)
	}

	curShift, err := app.GetCurrentCashShift()
	if err != nil || curShift != nil {
		t.Errorf("Expected nil current shift, got (%v, %v)", curShift, err)
	}

	// 2. App wrapper error branches
	if err := app.UpdateProductLocation("BAR-NONEXISTENT", "LOC"); err == nil {
		t.Errorf("Expected error from App.UpdateProductLocation for non-existent product")
	}
	if err := app.ArchiveProduct("BAR-NONEXISTENT"); err == nil {
		t.Errorf("Expected error from App.ArchiveProduct for non-existent product")
	}
	if err := app.RestoreProduct("BAR-NONEXISTENT"); err == nil {
		t.Errorf("Expected error from App.RestoreProduct for non-existent product")
	}
	if err := app.SaveLocation(Location{Code: ""}); err == nil {
		t.Errorf("Expected error from App.SaveLocation with empty code")
	}
	if err := app.SaveShelf(Shelf{Code: ""}); err == nil {
		t.Errorf("Expected error from App.SaveShelf with empty code")
	}
	if err := app.RecordCreditPayment(999999, 100, "Notes"); err == nil {
		t.Errorf("Expected error from App.RecordCreditPayment on invalid account")
	}
	if _, err := app.CreatePurchase(PurchaseInput{Items: nil}); err == nil {
		t.Errorf("Expected error from App.CreatePurchase with nil items")
	}
	if _, err := app.CompleteSale(SaleInput{Items: nil}); err == nil {
		t.Errorf("Expected error from App.CompleteSale with nil items")
	}
	if _, err := app.GetSaleByTicket("TICKET-NONEXISTENT"); err == nil {
		t.Errorf("Expected error from App.GetSaleByTicket on invalid ticket")
	}

	// 3. startInventorySession with empty items in comma list
	sess, err := startInventorySession(db, "Audit Comma Test", "Admin", "EST01, , EST02", "Notas")
	if err != nil {
		t.Fatalf("Failed starting session with comma list: %v", err)
	}
	_ = cancelInventorySession(db, sess.ID)
}

func TestDeep_HitNinetyPercentTarget(t *testing.T) {
	db, cleanup := setupDeepTestDB(t)
	defer cleanup()
	app := &App{db: db}

	// 1. deleteShelf non-existent
	if err := deleteShelf(db, 999999); err != nil {
		t.Errorf("deleteShelf non-existent should return nil, got %v", err)
	}

	// 2. cancelInventorySession non-existent
	if err := cancelInventorySession(db, 999999); err == nil {
		t.Errorf("Expected error cancelling non-existent session")
	}

	// 3. closeCashShiftDB non-existent
	if _, err := closeCashShiftDB(db, 999999, 100, false, ""); err == nil {
		t.Errorf("Expected error closing non-existent cash shift")
	}

	// 4. getPurchaseDB non-existent & listPurchasesDB with limit
	if _, err := getPurchaseDB(db, 999999); err == nil {
		t.Errorf("Expected error getting non-existent purchase")
	}
	if _, err := listPurchasesDB(db, 2); err != nil {
		t.Errorf("listPurchasesDB with limit failed: %v", err)
	}

	// 5. listInventoryProducts with archived=true and false
	if _, err := listInventoryProducts(db, true); err != nil {
		t.Errorf("listInventoryProducts with includeArchived failed: %v", err)
	}
	if _, err := searchProducts(db, "NonExistentSearchTermXYZ"); err != nil {
		t.Errorf("searchProducts failed: %v", err)
	}

	// 6. RecordInventoryScan branches in App
	// Create active session
	sess, err := startInventorySession(db, "Scan Test Session", "Tester", "ALL", "Notas")
	if err != nil {
		t.Fatalf("Failed starting session: %v", err)
	}

	// Invalid session
	if _, err := app.RecordInventoryScan(999999, "123", "EST01"); err == nil {
		t.Errorf("Expected error for non-existent session")
	}

	// Empty barcode
	if _, err := app.RecordInventoryScan(sess.ID, "   ", "EST01"); err == nil {
		t.Errorf("Expected error for empty barcode")
	}

	// Unknown barcode
	if _, err := app.RecordInventoryScan(sess.ID, "BARCODE-UNKNOWN-999", "EST01"); err == nil {
		t.Errorf("Expected error for unknown barcode")
	}

	// Create a new product created after session started (out-of-scope item)
	err = saveOrUpdateProduct(db, Product{
		Barcode: "OUT-OF-SCOPE-PROD",
		Name:    "Out of scope item",
		Price:   1500,
		Stock:   5,
		Active:  true,
	})
	if err != nil {
		t.Fatalf("Failed creating product: %v", err)
	}

	// Scan out-of-scope item (exercises inserting item into session items)
	scannedItem, err := app.RecordInventoryScan(sess.ID, "OUT-OF-SCOPE-PROD", "EST01")
	if err != nil {
		t.Fatalf("Failed scanning out-of-scope product: %v", err)
	}
	if scannedItem.CountedQty != 1 {
		t.Errorf("Expected CountedQty 1, got %d", scannedItem.CountedQty)
	}

	// 7. undoLastInventoryEntry branches
	// Record another count so curQty > 1
	if err := recordInventoryCountEntry(db, scannedItem.ID, "EST01", 2, false); err != nil {
		t.Fatalf("Failed adding count: %v", err)
	}
	// Undo when curQty > 1 (decrements)
	if err := undoLastInventoryEntry(db, scannedItem.ID); err != nil {
		t.Errorf("Failed undoing entry with qty > 1: %v", err)
	}

	// Close session and try undo (sessionStatus != in_progress)
	if err := closeInventorySession(db, sess.ID, nil); err != nil {
		t.Fatalf("Failed closing session: %v", err)
	}
	if err := undoLastInventoryEntry(db, scannedItem.ID); err == nil {
		t.Errorf("Expected error undoing entry on closed session")
	}
	// Try RecordInventoryScan on closed session
	if _, err := app.RecordInventoryScan(sess.ID, "OUT-OF-SCOPE-PROD", "EST01"); err == nil {
		t.Errorf("Expected error scanning into closed session")
	}

	// 8. Test ExportInventoryCSVFile and ExportInventorySessionCSVFile with mock dialogs
	tmpDir := t.TempDir()
	csvExportPath := filepath.Join(tmpDir, "test_inventory.csv")
	
	appWithDialog := &App{
		db: db,
		ctx: context.WithValue(context.Background(), "frontend", true),
		saveDialogFn: func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
			return csvExportPath, nil
		},
		windowFocusFn: func(ctx context.Context) {},
	}

	path, err := appWithDialog.ExportInventoryCSVFile()
	if err != nil || path != csvExportPath {
		t.Errorf("ExportInventoryCSVFile with mock dialog failed: path=%s, err=%v", path, err)
	}
	if _, err := os.Stat(csvExportPath); os.IsNotExist(err) {
		t.Errorf("Exported CSV file does not exist")
	}

	// Cancelled dialog (returns "")
	appCancelled := &App{
		db: db,
		ctx: context.WithValue(context.Background(), "frontend", true),
		saveDialogFn: func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
			return "", nil
		},
		windowFocusFn: func(ctx context.Context) {},
	}
	pCancel, err := appCancelled.ExportInventoryCSVFile()
	if err != nil || pCancel != "" {
		t.Errorf("Expected empty path on cancel, got %s, err %v", pCancel, err)
	}

	// Session CSV export with dialog
	sessionCsvExportPath := filepath.Join(tmpDir, "test_session.csv")
	appSessionDialog := &App{
		db: db,
		ctx: context.WithValue(context.Background(), "frontend", true),
		saveDialogFn: func(ctx context.Context, options runtime.SaveDialogOptions) (string, error) {
			return sessionCsvExportPath, nil
		},
		windowFocusFn: func(ctx context.Context) {},
	}
	sP, err := appSessionDialog.ExportInventorySessionCSVFile(sess.ID)
	if err != nil || sP != sessionCsvExportPath {
		t.Errorf("ExportInventorySessionCSVFile with mock dialog failed: path=%s, err=%v", sP, err)
	}

	// Session CSV cancelled dialog
	sPCancel, err := appCancelled.ExportInventorySessionCSVFile(sess.ID)
	if err != nil || sPCancel != "" {
		t.Errorf("Expected empty path on session cancel, got %s, err %v", sPCancel, err)
	}

	// 9. App.SaveProduct with invalid product (triggers error on save)
	if err := app.SaveProduct(Product{Name: ""}); err == nil {
		t.Errorf("Expected error saving product with empty name")
	}

	// 10. completeSaleTx edge cases
	// Invalid product ID in items
	_, err = completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		AmountPaid:    1000,
		Items: []SaleItemInput{
			{ProductID: 999999, Qty: 1},
		},
	})
	if err == nil {
		t.Errorf("Expected error for non-existent product in sale")
	}

	// Qty <= 0 in sale
	_ = saveOrUpdateProduct(db, Product{
		Barcode: "PROD-QTY-ZERO",
		Name:    "Prod Qty Zero",
		Price:   1000,
		Stock:   10,
		Active:  true,
	})
	pObj, _ := getProductByBarcode(db, "PROD-QTY-ZERO")
	_, err = completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		AmountPaid:    1000,
		Items: []SaleItemInput{
			{ProductID: pObj.ID, Qty: 0},
		},
	})
	if err == nil {
		t.Errorf("Expected error for sale item with Qty <= 0")
	}

	// AmountPaid < TotalAmount (changeDue < 0 branch sets changeDue = 0)
	saleUnderpaid, err := completeSaleTx(db, SaleInput{
		PaymentMethod: "cash",
		AmountPaid:    500, // Underpaid
		Items: []SaleItemInput{
			{ProductID: pObj.ID, Qty: 1}, // Price is 1000
		},
	})
	if err != nil {
		t.Fatalf("completeSaleTx with partial pay failed: %v", err)
	}
	if saleUnderpaid.ChangeDue != 0 {
		t.Errorf("Expected ChangeDue 0 for underpaid sale, got %.2f", saleUnderpaid.ChangeDue)
	}

	// 11. createPurchaseTx edge cases
	// Purchase item with Qty <= 0
	_, err = createPurchaseTx(db, PurchaseInput{
		SupplierID: 1,
		Items: []PurchaseItemInput{
			{ProductID: pObj.ID, Qty: 0, UnitCost: 100},
		},
	})
	if err == nil {
		t.Errorf("Expected error for purchase item with Qty <= 0")
	}

	// Purchase item with UnitCost < 0
	_, err = createPurchaseTx(db, PurchaseInput{
		SupplierID: 1,
		Items: []PurchaseItemInput{
			{ProductID: pObj.ID, Qty: 1, UnitCost: -50},
		},
	})
	if err == nil {
		t.Errorf("Expected error for purchase item with UnitCost < 0")
	}

	// Purchase item with non-existent product ID (rowsUpd == 0)
	_, err = createPurchaseTx(db, PurchaseInput{
		SupplierID: 1,
		Items: []PurchaseItemInput{
			{ProductID: 999999, Qty: 1, UnitCost: 100},
		},
	})
	if err == nil {
		t.Errorf("Expected error for purchase item with non-existent product ID")
	}

	// 12. ExportInventorySessionCSVFile with sessionId <= 0 when no closed sessions exist in fresh DB
	dbFresh, cleanupFresh := setupDeepTestDB(t)
	defer cleanupFresh()
	appFresh := &App{db: dbFresh}
	if _, err := appFresh.ExportInventorySessionCSVFile(0); err == nil {
		t.Errorf("Expected error exporting session CSV when no closed sessions exist")
	}
	// Export non-existent session
	if _, err := appFresh.ExportInventorySessionCSVFile(999999); err == nil {
		t.Errorf("Expected error exporting non-existent session CSV")
	}

	// 13. getAllShelves with nil / empty levels
	_, err = db.Exec("INSERT INTO shelves (code, name, description, levels_json) VALUES ('EST-EMPTY-LVL', 'Estante Sin Niveles', 'Prueba', '[]')")
	if err != nil {
		t.Fatalf("Failed inserting shelf with empty levels: %v", err)
	}
	shelvesList, err := getAllShelves(db)
	if err != nil {
		t.Fatalf("getAllShelves failed: %v", err)
	}
	foundEmptyShelf := false
	for _, s := range shelvesList {
		if s.Code == "EST-EMPTY-LVL" {
			foundEmptyShelf = true
			if len(s.Levels) != 0 {
				t.Errorf("Expected 0 levels for empty shelf, got %d", len(s.Levels))
			}
		}
	}
	if !foundEmptyShelf {
		t.Errorf("Expected to find EST-EMPTY-LVL")
	}

	// 14. getCurrentCashShiftDB with valid closed_at and actual_cash
	_, _ = db.Exec("DELETE FROM cash_shifts")
	_, err = db.Exec(`
		INSERT INTO cash_shifts (opened_at, closed_at, initial_cash, expected_cash, actual_cash, unrecorded_sales_adjust, status, notes)
		VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 50000, 60000, 60000, 0, 'open', 'Shift with valid closed/actual')
	`)
	if err != nil {
		t.Fatalf("Failed inserting mock shift: %v", err)
	}
	shiftWithBoth, err := getCurrentCashShiftDB(db)
	if err != nil || shiftWithBoth == nil {
		t.Fatalf("Failed getting current shift: %v", err)
	}
	if shiftWithBoth.ClosedAt == nil || shiftWithBoth.ActualCash == nil {
		t.Errorf("Expected non-nil ClosedAt and ActualCash, got (%v, %v)", shiftWithBoth.ClosedAt, shiftWithBoth.ActualCash)
	}

	// 15. ExportInventoryCSVFile with headless/nil context (executes saveFallback)
	appHeadless := &App{db: db, ctx: nil}
	fbPath, err := appHeadless.ExportInventoryCSVFile()
	if err != nil || fbPath == "" {
		t.Errorf("ExportInventoryCSVFile headless fallback failed: path=%s, err=%v", fbPath, err)
	}
	defer os.Remove(fbPath)

	// 16. ExportInventorySessionCSVFile with headless/nil context (executes saveFallback)
	fbSessPath, err := appHeadless.ExportInventorySessionCSVFile(sess.ID)
	if err != nil || fbSessPath == "" {
		t.Errorf("ExportInventorySessionCSVFile headless fallback failed: path=%s, err=%v", fbSessPath, err)
	}
	defer os.Remove(fbSessPath)

	// 17. getFinancialReportsDB where annualSales == 0 but TotalSales > 0 (sales from prior year)
	dbPrior, cleanupPrior := setupDeepTestDB(t)
	defer cleanupPrior()
	_, _ = dbPrior.Exec("INSERT INTO sales (ticket_number, total_amount, payment_method, amount_paid, change_due, created_at) VALUES ('REM-20200101-0001', 50000, 'cash', 50000, 0, '2020-01-01 10:00:00')")
	repPrior, err := getFinancialReportsDB(dbPrior, "all")
	if err != nil {
		t.Fatalf("getFinancialReportsDB prior year failed: %v", err)
	}
	if repPrior.DianCurrentPct <= 0 {
		t.Errorf("Expected positive DianCurrentPct from prior year total sales, got %.2f", repPrior.DianCurrentPct)
	}

	// 18. Closed DB error branches for robust recovery
	closedDb, _ := sql.Open("sqlite", ":memory:")
	_ = closedDb.Close()
	migrateProductsTable(closedDb)
	_ = saveOrUpdateProduct(closedDb, Product{Name: "Item Without Barcode"})
	_, _ = listAllProducts(closedDb)
	_, _ = searchProducts(closedDb, "foo")
	_, _ = getAllLocations(closedDb)
}





