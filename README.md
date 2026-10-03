# ⚡ iLuz POS & Inventario

> **Sistema punto de venta (POS), auditoría física de inventario y sincronización distribuida híbrida para minimercados y tiendas de abarrotes en Colombia.**
>
> Arquitectura *Local-First* con dos plataformas unificadas:
> - **🖥️ Windows PC (`iLuz.exe`):** Servidor maestro LAN, archivo central, compras administrativas y reportería financiera pesada / DIAN 3.500 UVT.
> - **📱 Sunmi D2 Android (`iLuz.apk`):** Terminal táctil en mostrador, único autor de ventas y caja (*Single-Writer*), escaneo continuo e impresora térmica integrada de tiques.

---

## 📖 Arquitectura del Sistema

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Sunmi D2 (Android - Mostrador)                        │
│  • Caja / Ventas / Cobro (F12) - Único escritor (Single-Writer)            │
│  • Turnos de caja y arqueo ciego con asimilación de sobrantes (Art. 616)    │
│  • Lector de código de barras USB (detección de ráfaga HID sin perder foco) │
│  • Impresora térmica integrada de tiques (AIDL Sunmi / ESC-POS)             │
│  • Entradas de mercancía de camiones en mostrador                           │
│  • Toma física de inventario cercano                                        │
│  • 100% Autónomo y Offline-First                                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                      Sincronización Silenciosa LAN (WiFi)
                      (Push de ventas / Pull de catálogo)
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PC Windows (Servidor & Oficina)                     │
│  • Servidor HTTP LAN en segundo plano (Puerto :8085) con token de enlace    │
│  • Base de datos SQLite maestra (modo WAL)                                  │
│  • Reportería Financiera: Ventas, compras y margen bruto (Semanal/Mes/Año)  │
│  • Semáforo fiscal: Monitoreo de tope 3.500 UVT de la DIAN                  │
│  • Catálogo maestro y configuración de tienda                               │
│  • Archivo histórico centralizado y respaldo                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Módulos y Características

### 1. Punto de Venta y Cobro Rápido (POS)
- **Cobro Rápido (<kbd>F12</kbd>):** Formas de pago en Efectivo, Transferencia (Nequi/Daviplata/Bancolombia) y Crédito (*Fiao*).
- **Ventas con Stock Negativo Controlado:** Permite registrar ventas de productos con stock en 0 o negativo con advertencia visual sutil, evitando detener el despacho al cliente.
- **Productos de Acceso Rápido:** Botones táctiles directos en barra superior para menudeo sin código de barras (pan, huevos, cilantro) y modal expandida con buscador.
- **Pausar Venta / Carritos en Espera:** Permite atender al siguiente cliente sin perder la venta en curso.
- **Tiquete Térmico:** Formateo automático de comprobantes internos para impresora Sunmi de 80mm/58mm.

### 2. Gestión de Turnos de Caja (Arqueo Fiscal)
- **Apertura de Turno:** Registro de base inicial de efectivo en gaveta.
- **Arqueo Ciego al Cierre:** El cajero cuenta el dinero físico sin ver el acumulado del sistema.
- **Asimilación de Sobrantes (Art. 616-2 E.T.):** Si el conteo supera el valor esperado por ventas no marcadas, un botón especial cuadra la diferencia a cero registrándola como venta rápida asimilada.

### 3. Entradas de Mercancía por Pedido / Factura de Proveedor
- **Recepción en Vivo:** Escaneo de los productos del pedido a medida que se descargan del camión.
- **Márgenes y Precios Sugeridos:** Si el costo del distribuidor subió, el sistema sugiere automáticamente el nuevo precio de venta para mantener la rentabilidad.
- **Adjuntos:** Soporte para adjuntar fotografía o PDF de la factura física.
- **Historial de Compras:** Liquidación total de compras por proveedor y estado de pago.

### 4. Proveedores y Distribuidores (CRUD)
- Directorio de proveedores con NIT, contacto comercial, teléfono con enlace directo a llamada o WhatsApp, plazo de pago (contado o crédito) y días de visita.

### 5. Auditoría Física de Inventario (Toma de Inventario)
- **Restricción por Estantería:** Conteo restringido exclusivamente a estanterías completas o toda la tienda.
- **Escaneo Inteligente:** Si se escanea un producto existente, abre la modal de edición directa; si no existe, lo matricula en caliente.
- **Conciliación Temporal Inmune a Ventas:** Si se registran ventas o compras durante el conteo, el sistema las compensa automáticamente (`final = contado - ventas + compras`).
- **Exportación CSV Blindada:** Generación de reportes CSV con fallback automático para evitar bloqueos del sistema.

### 6. Reportería Financiera & Monitoreo DIAN
- Métricas comparativas (Esta Semana, Este Mes, Este Año) de ventas brutas, compras a proveedores, número de transacciones y ticket promedio.
- **Medidor de Tope 3.500 UVT:** Monitoreo porcentual acumulado frente al límite legal de la DIAN para personas naturales no responsables de IVA (con alertas verde, ámbar y roja).

### 7. Sincronización en Red Local (LAN)
- **Servidor HTTP Go (`sync_server.go`):** Escucha en el puerto `8085` de la red local del PC.
- **Emparejamiento Seguro:** Autenticación por cabecera `X-Sync-Token` con código configurable en pantalla.
- **Cero Conflictos (Single-Writer):** Las ventas se originan únicamente en el Sunmi D2 y se ingieren de forma idempotente en el PC (`device_id`).

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Backend PC** | Go 1.22, Wails v2, SQLite WAL (`modernc.org/sqlite` - 100% pure Go) |
| **Frontend UI** | React 18, Vite, Lucide Icons, CSS responsivo y táctil |
| **Móvil Android** | Capacitor 7, Gradle, Android SDK (`minSdkVersion = 24`) |
| **Hardware** | Honeywell Orbit MS7120 (Serial COM), Escáner USB (HID burst), Sunmi Thermal Printer (AIDL) |

---

## 🚀 Compilación y Despliegue

### Requisitos
- **Go 1.22+**
- **Node.js 18+** y `npm`
- **Wails CLI v2:** `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **JDK 17** y Android SDK (para compilar el APK)

### 1. Ejecutar en Modo Desarrollo (PC)
```bash
cd tienda-pos
wails dev
```

### 2. Ejecutar Pruebas Automatizadas (>90% Cobertura)
```bash
cd tienda-pos
go test -timeout 35s -coverprofile=coverage.out ./...
go tool cover -func=coverage.out | tail -n 1
```

### 3. Compilar Ejecutable para Windows (`.exe`)
```bash
cd tienda-pos
wails build -platform windows/amd64 -clean
```
Salida generada: **`tienda-pos/build/bin/iLuz.exe`** (14 MB).

### 4. Compilar APK para Android / Sunmi D2 (`.apk`)
```bash
cd tienda-pos/frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
Salida generada: **`tienda-pos/build/bin/iLuz.apk`** (4.0 MB).

---

## 🔌 Puesta en Marcha en la Tienda

1. **En el PC:**
   - Inicia `iLuz.exe`.
   - Abre **Configuración ⚙️ ➔ Sincronización en Red Local**.
   - Toma nota de la IP (ej. `http://192.168.1.50:8085`) y el token de emparejamiento.
2. **En el Sunmi D2:**
   - Instala `iLuz.apk` desde una memoria USB.
   - En **Configuración ⚙️**, escribe la IP del PC y el token, y pulsa **"Probar Conexión"**.
   - La caja quedará enlazada: todas las ventas se guardan en el Sunmi y se replican silenciosamente al PC.

---

## 📄 Licencia

Software de punto de venta e inventario desarrollado por Julian Porras para iLuz.
