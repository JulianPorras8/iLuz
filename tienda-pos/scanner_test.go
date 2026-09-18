package main

import (
	"context"
	"testing"
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
	// Should execute without panicking
	ports := getAvailableSerialPorts()
	if ports == nil {
		t.Fatal("expected non-nil slice from getAvailableSerialPorts")
	}
}
