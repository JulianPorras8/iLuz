import csv
import json
import math
from collections import defaultdict
from process_inventory import TYPO_FIXES, clean_name
from perfect_taxonomy import get_perfect_category

raw_file = '/Users/julian.porras/Documents/Personal/Projects_Organized/Projects/iLuz/tienda-pos/data/inventario_raw.csv'
output_csv = '/Users/julian.porras/Documents/Personal/Projects_Organized/Projects/iLuz/tienda-pos/data/inventario_organizado.csv'
output_json = '/Users/julian.porras/Documents/Personal/Projects_Organized/Projects/iLuz/tienda-pos/data/inventario_organizado.json'

# Step 1: Read raw items
raw_items = []
with open(raw_file, 'r', encoding='utf-8') as f:
    b = 0
    for line in f:
        line_str = line.strip()
        if not line_str: continue
        if 'INVENTARIO TIENDA MIXTA' in line_str:
            b += 1
            continue
        if 'CANTIDAD,ARTICULO' in line_str: continue
        parts = [p.strip() for p in line_str.split(',')]
        if len(parts) >= 2 and parts[1]:
            qty_str = parts[0]
            name_raw = parts[1]
            cost_str = parts[2] if len(parts) > 2 else ''
            raw_items.append({
                'block': b,
                'qty_raw': qty_str,
                'name_raw': name_raw,
                'cost_raw': cost_str
            })

print(f"Total raw items read: {len(raw_items)}")

# Step 2: Consolidate duplicates
consolidated = {}

for it in raw_items:
    c_name = clean_name(it['name_raw'])
    qty = 0
    if it['qty_raw']:
        try:
            qty = int(it['qty_raw'])
        except:
            qty = 0

    cost = 0.0
    if it['cost_raw']:
        try:
            cost = float(it['cost_raw'])
        except:
            cost = 0.0

    category = get_perfect_category(c_name)

    if c_name not in consolidated:
        consolidated[c_name] = {
            'nombre': c_name,
            'categoria': category,
            'cantidad': qty,
            'precio_costo': cost,
            'bloques_origen': [it['block']],
            'nombres_originales': [it['name_raw']],
        }
    else:
        existing = consolidated[c_name]
        existing['cantidad'] += qty
        existing['bloques_origen'].append(it['block'])
        existing['nombres_originales'].append(it['name_raw'])
        if existing['precio_costo'] == 0 and cost > 0:
            existing['precio_costo'] = cost
        elif cost > 0 and existing['precio_costo'] > 0:
            existing['precio_costo'] = max(existing['precio_costo'], cost)

print(f"Total unique consolidated items: {len(consolidated)}")

def calculate_suggested_price(cost, category):
    if cost <= 0:
        return 0, 0.0
    
    # Target margins by category
    if category in ['Abarrotes y Despensa', 'Lácteos, Huevos y Refrigerados']:
        markup = 1.20 # ~16.7% margin
    elif category in ['Bebidas y Refrescos', 'Licores y Cervezas', 'Carnes y Embutidos', 'Snacks y Pasabocas', 'Panadería, Repostería y Dulcería', 'Aseo del Hogar y Lavandería', 'Alimento para Mascotas']:
        markup = 1.25 # 20% margin
    elif category in ['Cuidado Personal y Cosméticos']:
        markup = 1.30 # ~23% margin
    elif category in ['Farmacia y Botiquín', 'Papelería, Escolar y Oficina', 'Ferretería, Hogar y Miscelánea']:
        markup = 1.35 # ~26% margin
    else:
        markup = 1.25

    raw_price = cost * markup

    if raw_price <= 500:
        p = round(raw_price / 50.0) * 50
        suggested = max(100, int(p))
    elif raw_price <= 5000:
        suggested = int(math.ceil(raw_price / 100.0) * 100)
    elif raw_price <= 20000:
        suggested = int(math.ceil(raw_price / 100.0) * 100)
    else:
        suggested = int(math.ceil(raw_price / 500.0) * 500)

    margin_pct = round(((suggested - cost) / suggested) * 100, 1) if suggested > 0 else 0.0
    return suggested, margin_pct

category_order = [
    'Abarrotes y Despensa',
    'Lácteos, Huevos y Refrigerados',
    'Carnes y Embutidos',
    'Bebidas y Refrescos',
    'Licores y Cervezas',
    'Snacks y Pasabocas',
    'Panadería, Repostería y Dulcería',
    'Aseo del Hogar y Lavandería',
    'Cuidado Personal y Cosméticos',
    'Farmacia y Botiquín',
    'Papelería, Escolar y Oficina',
    'Ferretería, Hogar y Miscelánea',
    'Alimento para Mascotas'
]

sorted_items = []
item_id = 1
for cat in category_order:
    cat_items = [p for p in consolidated.values() if p['categoria'] == cat]
    cat_items.sort(key=lambda x: x['nombre'])
    for p in cat_items:
        cost = p['precio_costo']
        suggested_price, margin_pct = calculate_suggested_price(cost, cat)
        status_cost = "Costeado" if cost > 0 else "Pendiente por Costear"
        
        sorted_items.append({
            'id': item_id,
            'categoria': p['categoria'],
            'articulo': p['nombre'],
            'cantidad_stock': p['cantidad'],
            'precio_costo_cop': int(cost) if cost > 0 else '',
            'precio_venta_sugerido_cop': suggested_price if suggested_price > 0 else '',
            'margen_estimado': f"{margin_pct}%" if margin_pct > 0 else '',
            'estado_costo': status_cost,
            'origen': f"Estante {','.join(map(str, sorted(set(p['bloques_origen']))))}"
        })
        item_id += 1

print(f"Total organized items ready for export: {len(sorted_items)}")

# Step 3: Write CSV with UTF-8 BOM
with open(output_csv, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow([
        'ID',
        'CATEGORIA',
        'ARTICULO',
        'CANTIDAD_STOCK',
        'PRECIO_COSTO_COP',
        'PRECIO_VENTA_SUGERIDO_COP',
        'MARGEN_ESTIMADO',
        'ESTADO_COSTO',
        'ESTANTE_ORIGINAL'
    ])
    for it in sorted_items:
        writer.writerow([
            it['id'],
            it['categoria'],
            it['articulo'],
            it['cantidad_stock'],
            it['precio_costo_cop'],
            it['precio_venta_sugerido_cop'],
            it['margen_estimado'],
            it['estado_costo'],
            it['origen']
        ])

print(f"CSV saved successfully: {output_csv}")

# Step 4: Write JSON
with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(sorted_items, f, ensure_ascii=False, indent=2)

print(f"JSON saved successfully: {output_json}")
