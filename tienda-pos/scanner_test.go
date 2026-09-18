package main

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"go.bug.st/serial"
)

func TestProcessScannedBarcode(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	ctx := context.Background()

	// 1. Empty barcode
	resEmpty := processScannedBarcode(ctx, db, "")
	if resEmpty.Found {
		t.Errorf("expected empty barcode not to be found")
	}
	if resEmpty.Message != "Código vacío" {
		t.Errorf("expected 'Código vacío', got '%s'", resEmpty.Message)
	}

	// 2. Unregistered barcode
	resUnreg := processScannedBarcode(ctx, db, "9999999999999")
	if resUnreg.Found {
		t.Errorf("expected unregistered barcode not to be found")
	}
	if resUnreg.Barcode != "9999999999999" {
		t.Errorf("expected barcode '9999999999999', got '%s'", resUnreg.Barcode)
	}
	if resUnreg.Message != "Producto no registrado" {
		t.Errorf("expected 'Producto no registrado', got '%s'", resUnreg.Message)
	}

	// 3. Registered barcode
	p := Product{
		Barcode: "7709991112223",
		Name:    "Galletas Festival",
		Price:   1200.0,
		Stock:   50,
		Active:  true,
	}
	if err := saveOrUpdateProduct(db, p); err != nil {
		t.Fatalf("failed saving test product: %v", err)
	}

	resReg := processScannedBarcode(ctx, db, "  7709991112223 \n") // test trimming
	if !resReg.Found {
		t.Fatalf("expected registered barcode to be found")
	}
	if resReg.Product == nil {
		t.Fatalf("expected non-nil product in payload")
	}
	if resReg.Product.Name != "Galletas Festival" {
		t.Errorf("expected product name 'Galletas Festival', got '%s'", resReg.Product.Name)
	}
	if resReg.Product.Price != 1200.0 {
		t.Errorf("expected product price 1200.0, got %f", resReg.Product.Price)
	}
}

func TestGetAvailableSerialPorts(t *testing.T) {
	// 1. Default system call
	ports := getAvailableSerialPorts()
	if ports == nil {
		t.Fatal("expected non-nil slice from getAvailableSerialPorts")
	}

	// 2. Mock error or empty
	origGetPortsList := getPortsList
	defer func() { getPortsList = origGetPortsList }()

	getPortsList = func() ([]string, error) {
		return nil, errors.New("serial driver error")
	}
	emptyPorts := getAvailableSerialPorts()
	if len(emptyPorts) != 0 {
		t.Errorf("expected empty slice on error, got: %v", emptyPorts)
	}

	getPortsList = func() ([]string, error) {
		return []string{}, nil
	}
	emptyPorts2 := getAvailableSerialPorts()
	if len(emptyPorts2) != 0 {
		t.Errorf("expected empty slice on empty list, got: %v", emptyPorts2)
	}
}

type mockSerialPort struct {
	readData []byte
	readPos  int
	readErr  error
	closed   bool
}

func (m *mockSerialPort) Read(p []byte) (int, error) {
	if m.readErr != nil {
		return 0, m.readErr
	}
	if m.readPos >= len(m.readData) {
		return 0, nil // timeout (n=0)
	}
	n := copy(p, m.readData[m.readPos:])
	m.readPos += n
	return n, nil
}

func (m *mockSerialPort) Close() error {
	m.closed = true
	return nil
}

func (m *mockSerialPort) SetReadTimeout(t time.Duration) error                  { return nil }
func (m *mockSerialPort) SetMode(mode *serial.Mode) error                       { return nil }
func (m *mockSerialPort) Write(p []byte) (int, error)                           { return len(p), nil }
func (m *mockSerialPort) Drain() error                                          { return nil }
func (m *mockSerialPort) ResetInputBuffer() error                               { return nil }
func (m *mockSerialPort) ResetOutputBuffer() error                              { return nil }
func (m *mockSerialPort) SetDTR(dtr bool) error                                 { return nil }
func (m *mockSerialPort) SetRTS(rts bool) error                                 { return nil }
func (m *mockSerialPort) GetModemStatusBits() (*serial.ModemStatusBits, error) { return &serial.ModemStatusBits{}, nil }
func (m *mockSerialPort) Break(d time.Duration) error                          { return nil }

func TestScannerWorker_FullLifecycleAndRead(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	_ = saveOrUpdateProduct(db, Product{Barcode: "BAR-READ", Name: "Mock Item", Price: 10, Stock: 5, Active: true})

	origOpen := openSerialPort
	defer func() { openSerialPort = origOpen }()

	mockPort := &mockSerialPort{
		readData: []byte("BAR-READ\r\n"),
	}

	openSerialPort = func(portName string, mode *serial.Mode) (serial.Port, error) {
		return mockPort, nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	statusCh := make(chan ScannerStatusPayload, 10)
	go startScannerWorker(ctx, db, "COM3", func(s ScannerStatusPayload) {
		statusCh <- s
	})

	// Wait for connected status
	select {
	case s := <-statusCh:
		if !s.Connected {
			t.Errorf("expected connected=true, got false")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for connected status")
	}

	// Give worker time to read the barcode line
	time.Sleep(50 * time.Millisecond)

	// Inject read error to test error handling & reconnect path
	mockPort.readErr = errors.New("device disconnected")

	select {
	case s := <-statusCh:
		if s.Connected {
			t.Errorf("expected disconnected status after read error")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for disconnected status")
	}

	cancel()
}

func TestScannerWorker_ErrorAndEdgePaths(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	origOpen := openSerialPort
	origGetPorts := getPortsList
	defer func() {
		openSerialPort = origOpen
		getPortsList = origGetPorts
	}()

	// 1. Context canceled upfront
	canceledCtx, cancel := context.WithCancel(context.Background())
	cancel()
	startScannerWorker(canceledCtx, db, "COM3", func(s ScannerStatusPayload) {})

	// 2. Open returns error
	openSerialPort = func(portName string, mode *serial.Mode) (serial.Port, error) {
		return nil, errors.New("permission denied")
	}
	ctxTimeout, cancelTimeout := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancelTimeout()
	startScannerWorker(ctxTimeout, db, "COM3", func(s ScannerStatusPayload) {})

	// 3. Target port empty with no available ports
	getPortsList = func() ([]string, error) { return []string{}, nil }
	ctxEmpty, cancelEmpty := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancelEmpty()
	startScannerWorker(ctxEmpty, db, "", func(s ScannerStatusPayload) {})

	// 4. emitStatus with onStatus == nil fallback
	ctxNoCallback, cancelNoCallback := context.WithCancel(context.Background())
	cancelNoCallback()
	startScannerWorker(ctxNoCallback, db, "COM3", nil)
}

func TestProcessScannedBarcode_DatabaseError(t *testing.T) {
	db, cleanup := setupTestDB(t)
	cleanup() // close db immediately to trigger database error

	res := processScannedBarcode(context.Background(), db, "12345")
	if res.Found {
		t.Errorf("expected not found on closed db")
	}
	if !strings.Contains(res.Message, "Error de base de datos") {
		t.Errorf("expected database error message, got: '%s'", res.Message)
	}
}

