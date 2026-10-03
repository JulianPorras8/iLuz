package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

func TestSyncServer_Ping(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	server := NewSyncServer(db, 8086, "test-token")
	err := server.Start()
	if err != nil {
		t.Fatalf("Expected no error starting server, got: %v", err)
	}
	defer server.Stop()

	// Wait briefly for server to start
	time.Sleep(100 * time.Millisecond)

	resp, err := http.Get("http://localhost:8086/api/sync/ping")
	if err != nil {
		t.Fatalf("Failed to ping: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%v'", result["status"])
	}
}

func TestSyncServer_Auth(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	server := NewSyncServer(db, 8087, "secret")
	err := server.Start()
	if err != nil {
		t.Fatalf("Expected no error starting server, got: %v", err)
	}
	defer server.Stop()
	time.Sleep(100 * time.Millisecond)

	req, _ := http.NewRequest("GET", "http://localhost:8087/api/sync/catalog", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", resp.StatusCode)
	}

	req.Header.Set("X-Sync-Token", "secret")
	resp2, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to request: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp2.StatusCode)
	}
}

func TestSyncServer_SalesIngestion(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	server := NewSyncServer(db, 8088, "")
	err := server.Start()
	if err != nil {
		t.Fatalf("Expected no error starting server, got: %v", err)
	}
	defer server.Stop()
	time.Sleep(100 * time.Millisecond)

	_ = saveOrUpdateProduct(db, Product{Barcode: "123", Name: "Prod 1", Price: 50.0})
	var pid int64
	db.QueryRow("SELECT id FROM products WHERE barcode = '123'").Scan(&pid)

	sales := []Sale{
		{
			TicketNumber:  "TKT-100",
			TotalAmount:   100.0,
			PaymentMethod: "cash",
			AmountPaid:    100.0,
			CreatedAt:     time.Now().Format(time.RFC3339),
			Items: []SaleItem{
				{ProductID: pid, Barcode: "123", ProductName: "Prod 1", Qty: 2, UnitPrice: 50.0},
			},
		},
	}

	body, _ := json.Marshal(sales)
	resp, err := http.Post("http://localhost:8088/api/sync/sales", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to post sales: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Idempotent test
	resp2, err := http.Post("http://localhost:8088/api/sync/sales", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to post sales: %v", err)
	}
	defer resp2.Body.Close()

	var res map[string]int
	json.NewDecoder(resp2.Body).Decode(&res)
	if res["received"] != 1 || res["ingested"] != 1 {
		t.Errorf("Expected received 1, ingested 1 (since it's skipped internally), got %v", res)
	}
}

func TestSyncServer_ShiftsIngestion(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	server := NewSyncServer(db, 8089, "")
	err := server.Start()
	if err != nil {
		t.Fatalf("Expected no error starting server, got: %v", err)
	}
	defer server.Stop()
	time.Sleep(100 * time.Millisecond)

	shifts := []CashShift{
		{
			OpenedAt:    time.Now().Format(time.RFC3339),
			InitialCash: 50.0,
			Status:      "open",
		},
	}

	body, _ := json.Marshal(shifts)
	resp, err := http.Post("http://localhost:8089/api/sync/shifts", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to post shifts: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestSyncServer_Catalog(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	server := NewSyncServer(db, 8090, "")
	err := server.Start()
	if err != nil {
		t.Fatalf("Expected no error starting server, got: %v", err)
	}
	defer server.Stop()
	time.Sleep(100 * time.Millisecond)

	resp, err := http.Get("http://localhost:8090/api/sync/catalog?since=123")
	if err != nil {
		t.Fatalf("Failed to get catalog: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestSyncServer_Purchase(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	server := NewSyncServer(db, 8091, "")
	err := server.Start()
	if err != nil {
		t.Fatalf("Expected no error starting server, got: %v", err)
	}
	defer server.Stop()
	time.Sleep(100 * time.Millisecond)

	// Need a supplier for a valid purchase
	supp, _ := saveSupplierDB(db, Supplier{Name: "Sup1"})

	_ = saveOrUpdateProduct(db, Product{Barcode: "123", Name: "Prod 1", Price: 50.0})
	var pid int64
	db.QueryRow("SELECT id FROM products WHERE barcode = '123'").Scan(&pid)

	input := PurchaseInput{
		SupplierID:    supp.ID,
		InvoiceNumber: "INV-001",
		TotalCost:     100.0,
		PaymentStatus: "paid",
		Items:         []PurchaseItemInput{
			{ProductID: pid, Barcode: "123", ProductName: "Prod 1", Qty: 2, UnitCost: 50.0},
		},
	}

	body, _ := json.Marshal(input)
	resp, err := http.Post("http://localhost:8091/api/sync/purchase", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to post purchase: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Idempotent test
	resp2, err := http.Post("http://localhost:8091/api/sync/purchase", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to post purchase 2: %v", err)
	}
	defer resp2.Body.Close()
	var res map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&res)
	if res["purchase_id"] != float64(0) {
		t.Errorf("Expected 0 for idempotent purchase_id, got %v", res["purchase_id"])
	}
}

func TestGetLocalIPAddresses(t *testing.T) {
	ips := GetLocalIPAddresses()
	if len(ips) == 0 {
		t.Log("No local non-loopback IPs found, but that might be normal on some CI/CD environments.")
	} else {
		t.Logf("Found local IPs: %v", ips)
	}
}

func TestSyncServer_EdgeCases(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	server := NewSyncServer(db, 8092, "")
	
	// Stop when not running
	if err := server.Stop(); err != nil {
		t.Errorf("Stop when not running should not error: %v", err)
	}

	err := server.Start()
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	defer server.Stop()

	// Start when already running
	if err := server.Start(); err == nil {
		t.Errorf("Expected error starting when already running")
	}

	// Wrong methods
	resp, _ := http.Post("http://localhost:8092/api/sync/ping", "application/json", nil)
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("Ping POST expected 405, got %d", resp.StatusCode)
	}

	resp, _ = http.Get("http://localhost:8092/api/sync/sales")
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("Sales GET expected 405, got %d", resp.StatusCode)
	}

	resp, _ = http.Get("http://localhost:8092/api/sync/shifts")
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("Shifts GET expected 405, got %d", resp.StatusCode)
	}

	resp, _ = http.Post("http://localhost:8092/api/sync/catalog", "application/json", nil)
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("Catalog POST expected 405, got %d", resp.StatusCode)
	}

	resp, _ = http.Get("http://localhost:8092/api/sync/purchase")
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("Purchase GET expected 405, got %d", resp.StatusCode)
	}
	
	resp, _ = http.Get("http://localhost:8092/api/sync/inventory_audit")
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("Inventory GET expected 405, got %d", resp.StatusCode)
	}

	// Bad JSON body
	resp, _ = http.Post("http://localhost:8092/api/sync/sales", "application/json", bytes.NewBuffer([]byte("bad json")))
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Sales bad JSON expected 400, got %d", resp.StatusCode)
	}

	resp, _ = http.Post("http://localhost:8092/api/sync/shifts", "application/json", bytes.NewBuffer([]byte("bad json")))
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Shifts bad JSON expected 400, got %d", resp.StatusCode)
	}

	resp, _ = http.Post("http://localhost:8092/api/sync/purchase", "application/json", bytes.NewBuffer([]byte("bad json")))
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Purchase bad JSON expected 400, got %d", resp.StatusCode)
	}
	
	// Valid audit post
	resp, _ = http.Post("http://localhost:8092/api/sync/inventory_audit", "application/json", bytes.NewBuffer([]byte("{}")))
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Inventory POST expected 200, got %d", resp.StatusCode)
	}

	// Preflight OPTIONS CORS request
	optReq, _ := http.NewRequest(http.MethodOptions, "http://localhost:8092/api/sync/sales", nil)
	optResp, err := http.DefaultClient.Do(optReq)
	if err != nil || optResp.StatusCode != http.StatusOK {
		t.Errorf("OPTIONS preflight expected 200, got %v, err %v", optResp, err)
	}
	if optResp.Header.Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("Expected Access-Control-Allow-Origin: *")
	}

	// Catalog with since parameter
	sinceResp, err := http.Get("http://localhost:8092/api/sync/catalog?since=2026-01-01T00:00:00")
	if err != nil || sinceResp.StatusCode != http.StatusOK {
		t.Errorf("Catalog with since expected 200, got %v, err %v", sinceResp, err)
	}
}

func TestApp_SyncServerWailsMethods(t *testing.T) {
	app := NewApp()
	ctx := context.Background()
	app.startup(ctx)
	defer app.shutdown(ctx)

	status, err := app.GetSyncServerStatus()
	if err != nil {
		t.Errorf("GetSyncServerStatus error: %v", err)
	}
	if status["running"] != true {
		t.Errorf("Expected server running")
	}

	_, err = app.GetLocalIPs()
	if err != nil {
		t.Errorf("GetLocalIPs error: %v", err)
	}

	err = app.UpdateSyncPairToken("new-token")
	if err != nil {
		t.Errorf("UpdateSyncPairToken error: %v", err)
	}
}
