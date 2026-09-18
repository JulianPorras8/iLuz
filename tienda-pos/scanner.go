package main

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"go.bug.st/serial"
)

type ScanPayload struct {
	Found   bool     `json:"found"`
	Barcode string   `json:"barcode"`
	Product *Product `json:"product,omitempty"`
	Message string   `json:"message,omitempty"`
}

type ScannerStatusPayload struct {
	Connected      bool     `json:"connected"`
	Port           string   `json:"port"`
	Error          string   `json:"error,omitempty"`
	AvailablePorts []string `json:"availablePorts"`
}

var (
	getPortsList   = serial.GetPortsList
	openSerialPort = serial.Open
)

func getAvailableSerialPorts() []string {
	ports, err := getPortsList()
	if err != nil || len(ports) == 0 {
		return []string{}
	}
	return ports
}

func startScannerWorker(ctx context.Context, db *sql.DB, comPort string, onStatus func(ScannerStatusPayload)) {
	mode := &serial.Mode{
		BaudRate: 9600,
		DataBits: 8,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	}

	targetPort := comPort

	emitStatus := func(payload ScannerStatusPayload) {
		if onStatus != nil {
			onStatus(payload)
		} else {
			safeEmit(ctx, "scanner:status", payload)
		}
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		available := getAvailableSerialPorts()

		// If target port is empty, try first available port if any exists
		if targetPort == "" && len(available) > 0 {
			targetPort = available[0]
		}

		if targetPort == "" {
			emitStatus(ScannerStatusPayload{
				Connected:      false,
				Port:           targetPort,
				Error:          "No se detectaron puertos seriales COM disponibles.",
				AvailablePorts: available,
			})
			select {
			case <-ctx.Done():
				return
			case <-time.After(2 * time.Second):
			}
			continue
		}

		port, err := openSerialPort(targetPort, mode)
		if err != nil {
			emitStatus(ScannerStatusPayload{
				Connected:      false,
				Port:           targetPort,
				Error:          err.Error(),
				AvailablePorts: available,
			})
			select {
			case <-ctx.Done():
				return
			case <-time.After(2 * time.Second):
			}
			continue
		}

		// Configure read timeout to prevent indefinite blocking in Windows driver
		_ = port.SetReadTimeout(500 * time.Millisecond)

		emitStatus(ScannerStatusPayload{
			Connected:      true,
			Port:           targetPort,
			AvailablePorts: available,
		})

		buf := make([]byte, 256)
		var accumulator strings.Builder

		for {
			if ctx.Err() != nil {
				_ = port.Close()
				return
			}

			n, err := port.Read(buf)
			if err != nil {
				_ = port.Close()
				emitStatus(ScannerStatusPayload{
					Connected:      false,
					Port:           targetPort,
					Error:          err.Error(),
					AvailablePorts: getAvailableSerialPorts(),
				})
				// Brief backoff so the OS releases the port handle
				select {
				case <-ctx.Done():
					return
				case <-time.After(1 * time.Second):
				}
				break
			}

			if n == 0 {
				// Read timed out without data; continue listening
				continue
			}

			for i := 0; i < n; i++ {
				b := buf[i]
				if b == '\r' || b == '\n' {
					code := strings.TrimSpace(accumulator.String())
					accumulator.Reset()
					if code != "" {
						processScannedBarcode(ctx, db, code)
					}
				} else {
					accumulator.WriteByte(b)
				}
			}
		}
	}
}

func processScannedBarcode(ctx context.Context, db *sql.DB, barcode string) ScanPayload {
	code := strings.TrimSpace(barcode)
	payload := ScanPayload{Barcode: code}

	if code == "" {
		payload.Found = false
		payload.Message = "Código vacío"
		return payload
	}

	prod, err := getProductByBarcode(db, code)
	if err == sql.ErrNoRows {
		payload.Found = false
		payload.Message = "Producto no registrado"
	} else if err != nil {
		payload.Found = false
		payload.Message = "Error de base de datos: " + err.Error()
	} else {
		payload.Found = true
		payload.Product = prod
	}

	safeEmit(ctx, "barcode:scanned", payload)
	return payload
}
