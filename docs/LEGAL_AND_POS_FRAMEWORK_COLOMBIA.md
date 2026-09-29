# Marco Legal, Fiscal y Operativo POS en Colombia (Proyecto iLuz)

**Destinatario:** Tienda de abarrotes / Minimercado / Comercio Minorista  
**Régimen Tributario:** Persona Natural No Responsable de IVA (*antiguo Régimen Simplificado*)  
**Fecha de Publicación:** Septiembre 2026  
**Estatus:** Referencia Legal Oficial y Guía de Cumplimiento

---

## 1. Fundamento Normativo del Negocio

En Colombia, las obligaciones comerciales y fiscales de una tienda de abarrotes operada por personas naturales están regidas por:

1. **Estatuto Tributario de Colombia (E.T.)**:
   * **Art. 437, Parágrafo 3**: Define los requisitos para no ser responsable del IVA (ingresos anuales menores a 3.500 UVT, un solo establecimiento, sin explotación de intangibles, sin ser usuario aduanero, y consignaciones bancarias menores a 3.500 UVT).
   * **Art. 616-2**: Establece los casos donde **no se requiere expedición de factura**. Exonera expresamente a las personas naturales no responsables de IVA.
   * **Art. 616 (Libro Fiscal de Operaciones Diarias)**: Obliga a registrar diariamente las ventas globales y compras mensuales.
   * **Art. 62, 64, 65 y 66**: Regula los inventarios permanentes, prohibición del método UEPS (LIFO), y establece el tope deducible del 3% en mermas por fácil destrucción o pérdida.
   * **Art. 757**: Presunción legal de ventas omitidas cuando existen sobrantes físicos de inventario sin justificar documentalmente.
2. **Decreto Único Reglamentario 1625 de 2016 (DUR)**:
   * **Art. 1.6.1.4.3**: Lista a los no responsables de IVA como no obligados a facturar.
   * **Art. 1.6.1.4.12**: Regula el documento soporte en compras a no obligados.
3. **Resolución DIAN 000165 de 2023 y Resolución 000008 de 2024**:
   * Regula el sistema de facturación electrónica y el Documento Equivalente Electrónico POS.
   * Confirma la no obligatoriedad para no responsables de IVA.
   * Deroga el antiguo "Comprobante de Informe Diario de Ventas / Reporte Z" en papel a partir de julio de 2024.
4. **Código de Comercio de Colombia**:
   * **Art. 19, Numeral 3**: Obligación de todo comerciante de llevar contabilidad regular de sus negocios.
   * **Art. 52**: Obligación de realizar inventario físico al menos una vez al año.
5. **Normas de Información Financiera (NIIF Grupo 3 - Microempresas)**:
   * **Decreto 2420 de 2015 (Anexo 3)**: Contabilidad simplificada al costo histórico de causación.

---

## 2. Emisión de Ventas en Mostrador

| Situación | Regla Legal | Acción en iLuz |
| :--- | :--- | :--- |
| **Venta Normal a Vecino / Consumidor Final** | No requiere factura electrónica ni tiquete fiscal DIAN. | Emite **Comprobante de Venta Interno** (o tirilla de control). Nunca usar la palabra *"Factura"*. |
| **Cliente Exige Factura para Declarar Renta** | La tienda no está obligada. No puede ser multada. | Entrega comprobante interno + copia de RUT. El **comprador** genera en su propio software el *Documento Soporte Electrónico (DSE)* ante la DIAN (*Res. 000167/2021*). |
| **Leyenda Legal Obligatoria al Pie** | Evita sanciones por presunta facturación ilegal (Arts. 652 y 657 E.T.). | *"Documento para Control Interno - Persona Natural No Responsable del IVA (Art. 437 Par. 3 E.T.). No válido para deducción fiscal."* |

---

## 3. Realidad de Ventas No Registradas y Arqueo de Caja

En el comercio minorista tradicional de Colombia, un porcentaje significativo de transacciones menores (confitería, pan, huevos sueltos) no se digitan en el software durante las horas pico:

1. **Efecto Financiero**: El dinero físico en la gaveta supera las ventas registradas por el sistema (sobrante de caja).
2. **Cierre de Turno Realista**:
   * El cajero realiza un conteo ciego de su efectivo físico.
   * El sistema calcula la diferencia y permite: `[Asimilar Diferencia como Venta Global No Registrada]`.
   * Esto cuadra el efectivo a cero descuadre y respalda los ingresos para el *Libro Fiscal de Operaciones Diarias (Art. 616 E.T.)*.
3. **Conciliación de Inventario**:
   * La mercancía no marcada se concilia periódicamente mediante las **Auditorías Físicas por Zonas de iLuz**.
   * Las diferencias se ajustan con motivo: *"Salida por Venta No Registrada"*, protegiendo al comerciante de la presunción del Art. 757 E.T.

---

## 4. Inventarios, Costos e Impuestos

1. **Tratamiento del IVA de Compra**:
   * Como no son responsables de IVA, el IVA que facturan proveedores como Bavaria, Postobón o Nestlé **no es descontable** ante la DIAN.
   * Contable y fiscalmente se capitaliza como **mayor valor del costo** (`cost_price = Base + IVA`).
2. **Impuestos Saludables (ICUI / IBUA - Ley 2277 de 2022)**:
   * Gravan a productores e importadores de ultraprocesados y bebidas azucaradas.
   * La tienda no los liquida; ya vienen incluidos en el costo de compra del mayorista.
3. **Mermas de Perecederos (Art. 64 Numeral 1 E.T.)**:
   * Límite deducible del **3% sobre (Inventario Inicial + Compras)** para frutas, verduras, lácteos y huevos rotos.
   * No obliga a devolver el IVA descontable (Art. 486 E.T.).
4. **Bajas por Vencimiento (Art. 64 Numeral 2 E.T.)**:
   * Generación obligatoria del **Acta de Destrucción de Inventario en PDF** con fecha, SKU, descripción, costo fiscal, causa de vencimiento, método de destrucción y firmas.

---

## 5. Cuentas por Cobrar ("El Fiao") y Proveedores

* **El Fiao**: Módulo indispensable en tiendas de barrio (límite de crédito por vecino, saldo de deuda acumulado y recibos de abono parcial).
* **Proveedores**:
  * Control de días de crédito y vencimientos de facturas de distribuidoras.
  * Registro de llaves de pago móvil (Nequi, Daviplata, QR Bancolombia) para desembolsos inmediatos a repartidores.
  * Historial de variación de costos de compra para proteger el margen de utilidad.
