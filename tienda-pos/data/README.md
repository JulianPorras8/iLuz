# 📦 Catálogo Maestro de Inventario - Tienda Mixta J&K

Este directorio contiene los archivos del catálogo depurado y consolidado a partir del inventario original de la tienda:

## 📄 Archivos

1. **`inventario_organizado.csv`**:
   - Catálogo maestro de **631 productos únicos**, sin duplicados y clasificados en **13 categorías comerciales**.
   - Formato CSV codificado en UTF-8 con BOM (`utf-8-sig`) para compatibilidad directa con Microsoft Excel en Windows sin alteración de caracteres ni tildes.
   - Columnas: `ID`, `CATEGORIA`, `ARTICULO`, `CANTIDAD_STOCK`, `PRECIO_COSTO_COP`, `PRECIO_VENTA_SUGERIDO_COP`, `MARGEN_ESTIMADO`, `ESTADO_COSTO`, `ESTANTE_ORIGINAL`.
   - **479 productos costeados** con precios de venta sugeridos basados en márgenes comerciales estándar colombianos (15% - 35%).
   - **152 productos pendientes por costo** (señalizados como `Pendiente por Costear` para fácil filtrado y diligenciamiento en Excel).

2. **`inventario_organizado.json`**:
   - Estructura JSON con los mismos 631 productos para importación directa o procesamiento programático en iLuz POS.

3. **`inventario_raw.csv`**:
   - Archivo fuente original recibido con los 12 bloques de estantes y 638 registros brutos.

4. **`scripts/build_clean_inventory.py`**:
   - Script de generación que normaliza ortografía de marcas colombianas, fusiona duplicados, aplica la taxonomía comercial y calcula precios sugeridos con redondeo de moneda COP.
