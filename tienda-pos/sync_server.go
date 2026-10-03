package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

type SyncServer struct {
	db         *sql.DB
	httpServer *http.Server
	port       int
	pairToken  string
	mu         sync.RWMutex
	isRunning  bool
}

func NewSyncServer(db *sql.DB, port int, pairToken string) *SyncServer {
	return &SyncServer{
		db:        db,
		port:      port,
		pairToken: pairToken,
	}
}

func (s *SyncServer) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return fmt.Errorf("sync server is already running")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/sync/ping", s.handlePing)
	mux.HandleFunc("/api/sync/sales", s.authMiddleware(s.handleSales))
	mux.HandleFunc("/api/sync/shifts", s.authMiddleware(s.handleShifts))
	mux.HandleFunc("/api/sync/catalog", s.authMiddleware(s.handleCatalog))
	mux.HandleFunc("/api/sync/purchase", s.authMiddleware(s.handlePurchase))
	mux.HandleFunc("/api/sync/inventory_audit", s.authMiddleware(s.handleInventoryAudit))

	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.port),
		Handler: s.corsMiddleware(mux),
	}

	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("HTTP server ListenAndServe: %v\n", err)
		}
	}()

	s.isRunning = true
	return nil
}

func (s *SyncServer) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Sync-Token, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *SyncServer) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning || s.httpServer == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := s.httpServer.Shutdown(ctx)
	s.isRunning = false
	return err
}

func GetLocalIPAddresses() []string {
	var ips []string
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ips
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				ips = append(ips, ipnet.IP.String())
			}
		}
	}
	return ips
}

func (s *SyncServer) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		token := s.pairToken
		s.mu.RUnlock()

		if token != "" {
			reqToken := r.Header.Get("X-Sync-Token")
			if reqToken != token {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
		}
		next.ServeHTTP(w, r)
	}
}

func (s *SyncServer) handlePing(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	storeName := "Tienda POS"
	if cfg, err := getStoreConfigDB(s.db); err == nil && cfg.StoreName != "" {
		storeName = cfg.StoreName
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "ok",
		"store_name":  storeName,
		"version":     "1.0.0",
		"server_time": time.Now().Format(time.RFC3339),
	})
}

func (s *SyncServer) handleSales(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var sales []Sale
	if err := json.NewDecoder(r.Body).Decode(&sales); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	ingested := 0
	for _, sale := range sales {
		if err := ingestSyncedSaleTx(s.db, sale); err != nil {
			fmt.Printf("Error ingesting sale %s: %v\n", sale.TicketNumber, err)
			continue
		}
		ingested++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"received": len(sales),
		"ingested": ingested,
	})
}

func (s *SyncServer) handleShifts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var shifts []CashShift
	if err := json.NewDecoder(r.Body).Decode(&shifts); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	ingested := 0
	for _, shift := range shifts {
		// Idempotent ingestion of shift
		if err := ingestSyncedShiftTx(s.db, shift); err != nil {
			fmt.Printf("Error ingesting shift %d: %v\n", shift.ID, err)
			continue
		}
		ingested++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"received": len(shifts),
		"ingested": ingested,
	})
}

func (s *SyncServer) handleCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Optional ?since=TIMESTAMP
	since := r.URL.Query().Get("since")
	
	// To keep it simple, just fetching all for now, or based on active
	products, err := listInventoryProducts(s.db, true)
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	suppliers, err := listSuppliersDB(s.db, false)
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// Not explicitly filtering by since in DB query to save time, but we could filter here
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"products":  products,
		"suppliers": suppliers,
		"since":     since,
	})
}

func (s *SyncServer) handlePurchase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input PurchaseInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// Idempotent check: if purchase exists, return ok
	var exists bool
	err := s.db.QueryRow("SELECT 1 FROM purchases WHERE supplier_id = ? AND invoice_number = ?", input.SupplierID, input.InvoiceNumber).Scan(&exists)
	if err == nil && exists {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":      "ok",
			"purchase_id": 0, // Ignored existing
		})
		return
	}

	purch, err := createPurchaseTx(s.db, input)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "ok",
		"purchase_id": purch.ID,
	})
}

func (s *SyncServer) handleInventoryAudit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// Stub for inventory audit ingestion
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
	})
}
