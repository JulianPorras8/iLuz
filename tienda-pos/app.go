package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx           context.Context
	db            *sql.DB
	scannerCancel context.CancelFunc
	currentPort   string
	mu            sync.Mutex

	statusMu   sync.RWMutex
	lastStatus ScannerStatusPayload
}

func NewApp() *App {
	return &App{
		currentPort: "COM3",
		lastStatus: ScannerStatusPayload{
			Connected: false,
			Port:      "COM3",
			Error:     "Iniciando escáner...",
		},
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.db = initDB("inventario.db")
	a.startScanner(a.currentPort)
}

func (a *App) domReady(ctx context.Context) {
	a.EmitScannerStatus()
}

func (a *App) shutdown(ctx context.Context) {
	a.mu.Lock()
	if a.scannerCancel != nil {
		a.scannerCancel()
	}
	a.mu.Unlock()

	if a.db != nil {
		a.db.Close()
	}
}

func safeEmit(ctx context.Context, eventName string, data ...interface{}) {
	if ctx == nil || ctx.Value("events") == nil {
		return
	}
	runtime.EventsEmit(ctx, eventName, data...)
}

func (a *App) updateStatus(status ScannerStatusPayload) {
	a.statusMu.Lock()
	a.lastStatus = status
	a.statusMu.Unlock()

	safeEmit(a.ctx, "scanner:status", status)
}

func (a *App) EmitScannerStatus() {
	a.statusMu.RLock()
	status := a.lastStatus
	a.statusMu.RUnlock()

	safeEmit(a.ctx, "scanner:status", status)
}

func (a *App) GetScannerStatus() ScannerStatusPayload {
	a.statusMu.RLock()
	defer a.statusMu.RUnlock()
	return a.lastStatus
}

func (a *App) startScanner(portName string) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.scannerCancel != nil {
		a.scannerCancel()
	}

	workerCtx, cancel := context.WithCancel(a.ctx)
	a.scannerCancel = cancel
	a.currentPort = portName

	go startScannerWorker(workerCtx, a.db, portName, a.updateStatus)
}

func (a *App) SetScannerPort(portName string) {
	a.startScanner(portName)
}

func (a *App) GetAvailablePorts() []string {
	return getAvailableSerialPorts()
}

func (a *App) GetCurrentPort() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.currentPort
}

func (a *App) ProcessBarcode(barcode string) ScanPayload {
	return processScannedBarcode(a.ctx, a.db, barcode)
}

func (a *App) GetAllProducts() ([]Product, error) {
	return listAllProducts(a.db)
}

func (a *App) ListInventoryProducts(includeArchived bool) ([]Product, error) {
	return listInventoryProducts(a.db, includeArchived)
}

func (a *App) SearchProducts(query string) ([]Product, error) {
	return searchProducts(a.db, query)
}

func (a *App) SaveProduct(p Product) error {
	err := saveOrUpdateProduct(a.db, p)
	if err != nil {
		return err
	}
	prod, err := getProductByBarcode(a.db, p.Barcode)
	if err == nil {
		safeEmit(a.ctx, "product:updated", prod)
	}
	return nil
}

func (a *App) SearchBarcode(barcode string) (*Product, error) {
	return getProductByBarcode(a.db, barcode)
}

func (a *App) UpdateProductLocation(barcode string, location string) error {
	err := updateProductLocation(a.db, barcode, location)
	if err != nil {
		return err
	}
	// Re-emit updated product to keep UI in sync
	prod, err := getProductByBarcode(a.db, barcode)
	if err == nil {
		safeEmit(a.ctx, "barcode:scanned", ScanPayload{
			Found:   true,
			Barcode: barcode,
			Product: prod,
		})
		safeEmit(a.ctx, "product:updated", prod)
	}
	return nil
}

func (a *App) ArchiveProduct(barcode string) error {
	err := archiveProduct(a.db, barcode)
	if err != nil {
		return err
	}
	prod, err := getProductByBarcode(a.db, barcode)
	if err == nil {
		safeEmit(a.ctx, "product:updated", prod)
	}
	return nil
}

func (a *App) RestoreProduct(barcode string) error {
	err := restoreProduct(a.db, barcode)
	if err != nil {
		return err
	}
	prod, err := getProductByBarcode(a.db, barcode)
	if err == nil {
		safeEmit(a.ctx, "product:updated", prod)
	}
	return nil
}

func (a *App) GetAllLocations() ([]Location, error) {
	return getAllLocations(a.db)
}

func (a *App) SaveLocation(loc Location) error {
	return saveLocation(a.db, loc)
}

func (a *App) DeleteLocation(id int64) error {
	return deleteLocation(a.db, id)
}

func (a *App) ExportInventoryCSV() (string, error) {
	products, err := listInventoryProducts(a.db, true)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	// UTF-8 BOM for Microsoft Excel compatibility
	buf.WriteString("\xef\xbb\xbf")

	writer := csv.NewWriter(&buf)
	headers := []string{
		"Código",
		"Nombre",
		"Precio",
		"Stock",
		"Unidad",
		"Peso",
		"Tamaño",
		"Color",
		"Ubicación",
		"Estado",
	}
	if err := writer.Write(headers); err != nil {
		return "", err
	}

	for _, p := range products {
		status := "Activo"
		if !p.Active {
			status = "Archivado"
		}

		row := []string{
			p.Barcode,
			p.Name,
			fmt.Sprintf("%.2f", p.Price),
			strconv.Itoa(p.Stock),
			p.UnitOfMeasure,
			fmt.Sprintf("%.2f", p.Weight),
			p.Size,
			p.Color,
			p.Location,
			status,
		}
		if err := writer.Write(row); err != nil {
			return "", err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func (a *App) ExportInventoryCSVFile() (string, error) {
	csvData, err := a.ExportInventoryCSV()
	if err != nil {
		return "", err
	}

	if a.ctx == nil || a.ctx.Value("frontend") == nil {
		return "", fmt.Errorf("contexto de frontend no disponible para diálogo de archivo")
	}

	defaultName := fmt.Sprintf("inventario_%s.csv", time.Now().Format("2006-01-02"))
	selectedPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultName,
		Title:           "Exportar Inventario a CSV",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Archivos CSV (*.csv)",
				Pattern:     "*.csv",
			},
		},
	})
	// Restore focus to WebView2 window after common item dialog closes
	if a.ctx != nil && a.ctx.Value("frontend") != nil {
		runtime.WindowExecJS(a.ctx, "window.focus()")
	}
	if err != nil {
		return "", err
	}
	if selectedPath == "" {
		return "", nil // User cancelled
	}

	if err := os.WriteFile(selectedPath, []byte(csvData), 0644); err != nil {
		return "", fmt.Errorf("error escribiendo archivo CSV: %w", err)
	}

	return selectedPath, nil
}

// --- Physical Inventory Session Wails Methods ---

func (a *App) StartInventorySession(name, responsible, scope, notes string) (*InventorySession, error) {
	sess, err := startInventorySession(a.db, name, responsible, scope, notes)
	if err != nil {
		return nil, err
	}
	safeEmit(a.ctx, "inventory:session_changed", sess)
	return sess, nil
}

func (a *App) GetActiveInventorySession() (*InventorySession, error) {
	return getActiveInventorySession(a.db)
}

func (a *App) ListInventorySessionItems(sessionId int64) ([]InventorySessionItem, error) {
	return listInventorySessionItems(a.db, sessionId)
}

func (a *App) RecordInventoryScan(sessionId int64, barcode string, locationCode string) (*InventorySessionItem, error) {
	code := strings.TrimSpace(barcode)
	if code == "" {
		return nil, fmt.Errorf("código de barras vacío")
	}

	prod, err := getProductByBarcode(a.db, code)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("UNKNOWN_BARCODE:%s", code)
	}
	if err != nil {
		return nil, fmt.Errorf("error buscando producto: %w", err)
	}

	// Check if item is in session
	var itemID int64
	err = a.db.QueryRow(`
		SELECT id FROM inventory_session_items 
		WHERE session_id = ? AND product_id = ? 
		LIMIT 1;
	`, sessionId, prod.ID).Scan(&itemID)

	if err == sql.ErrNoRows {
		// Out-of-scope or newly added item: append to session with current stock as baseline
		res, insErr := a.db.Exec(`
			INSERT INTO inventory_session_items (
				session_id, product_id, barcode, product_name, location, unit_price, system_stock_at_start, counted_qty, is_counted
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0);
		`, sessionId, prod.ID, prod.Barcode, prod.Name, prod.Location, prod.Price, prod.Stock)
		if insErr != nil {
			return nil, fmt.Errorf("error agregando ítem a la toma de inventario: %w", insErr)
		}
		itemID, _ = res.LastInsertId()
	} else if err != nil {
		return nil, err
	}

	// Record +1 entry
	if err := recordInventoryCountEntry(a.db, itemID, locationCode, 1, false); err != nil {
		return nil, err
	}

	items, err := listInventorySessionItems(a.db, sessionId)
	if err != nil {
		return nil, err
	}

	var updatedItem *InventorySessionItem
	for _, it := range items {
		if it.ID == itemID {
			updatedItem = &it
			break
		}
	}

	safeEmit(a.ctx, "inventory:item_counted", updatedItem)
	return updatedItem, nil
}

func (a *App) RecordBatchCount(sessionItemId int64, locationCode string, qty int, replace bool) error {
	err := recordInventoryCountEntry(a.db, sessionItemId, locationCode, qty, replace)
	if err != nil {
		return err
	}
	safeEmit(a.ctx, "inventory:item_counted", sessionItemId)
	return nil
}

func (a *App) UndoLastCount(sessionItemId int64) error {
	err := undoLastInventoryEntry(a.db, sessionItemId)
	if err != nil {
		return err
	}
	safeEmit(a.ctx, "inventory:item_counted", sessionItemId)
	return nil
}

func (a *App) CloseInventorySession(sessionId int64, productIdsToUpdate []int64) error {
	err := closeInventorySession(a.db, sessionId, productIdsToUpdate)
	if err != nil {
		return err
	}
	safeEmit(a.ctx, "inventory:session_changed", nil)
	safeEmit(a.ctx, "product:updated", nil)
	return nil
}

func (a *App) CancelInventorySession(sessionId int64) error {
	err := cancelInventorySession(a.db, sessionId)
	if err != nil {
		return err
	}
	safeEmit(a.ctx, "inventory:session_changed", nil)
	return nil
}

func (a *App) ListCompletedInventorySessions() ([]InventorySession, error) {
	return listCompletedSessions(a.db)
}

func (a *App) ExportInventorySessionCSV(sessionId int64) (string, error) {
	return exportSessionReportCSV(a.db, sessionId)
}

func (a *App) ExportInventorySessionCSVFile(sessionId int64) (string, error) {
	csvData, err := a.ExportInventorySessionCSV(sessionId)
	if err != nil {
		return "", err
	}

	if a.ctx == nil || a.ctx.Value("frontend") == nil {
		return "", fmt.Errorf("contexto de frontend no disponible para diálogo de archivo")
	}

	defaultName := fmt.Sprintf("reporte_inventario_%s_%d.csv", time.Now().Format("2006-01-02"), sessionId)
	selectedPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultName,
		Title:           "Exportar Reporte de Auditoría a CSV",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Archivos CSV (*.csv)",
				Pattern:     "*.csv",
			},
		},
	})
	if a.ctx != nil && a.ctx.Value("frontend") != nil {
		runtime.WindowExecJS(a.ctx, "window.focus()")
	}
	if err != nil {
		return "", err
	}
	if selectedPath == "" {
		return "", nil // User cancelled
	}

	if err := os.WriteFile(selectedPath, []byte(csvData), 0644); err != nil {
		return "", fmt.Errorf("error escribiendo archivo CSV: %w", err)
	}

	return selectedPath, nil
}

