import re

# Complete regex mapping with explicit priorities
TAXONOMY_RULES = [
    # 1. Mascotas
    ('Alimento para Mascotas', [
        r'DOG CHOW', r'MIRRINGO', r'DON CAT', r'DOGOURMET', r'CHUNKY',
        r'NUTRECAN', r'RINGO', r'OHMAIGAT', r'Q-IDA CAT', r'WHISKAS',
        r'ALPISTE', r'PAJARINA', r'SEMILLAS DE GIRASOL'
    ]),
    
    # 2. Carnes y Embutidos
    ('Carnes y Embutidos', [
        r'PECHUGA', r'PERNIL', r'VÍSCERAS', r'SANTIPOLLO', r'BUCANERO', r'CARNE DE RES',
        r'CARNE MOLIDA', r'CARNE DE CERDO', r'CHULETÓN', r'COSTILLA AHUMADA', r'SALCHICHA',
        r'SALCHICHÓN', r'MORTADELA', r'JAMÓN', r'CHORIZO', r'FILETES DE PECHUGA', r'YUCA'
    ]),

    # 3. Licores y Cervezas
    ('Licores y Cervezas', [
        r'CERVEZA', r'LOS CUATES', r'REFAJO'
    ]),

    # 4. Panadería, Repostería y Dulcería
    ('Panadería, Repostería y Dulcería', [
        r'CHOCOLATINA', r'CHOCORRAMO', r'CHOCOSO', r'SUBMARINO', r'GALA', r'BROWNIE',
        r'GALLETA', r'CRAQUEÑA', r'DORADITA', r'SALTÍN', r'DUCALES', r'FESTIVAL', r'OREO',
        r'MILO SÁNDWICH', r'CHOKIS', r'BRITE', r'RONDALLA', r'CLUB SOCIAL', r'DUX', r'CUCAS',
        r'MAMUT', r'BOMBÓN BUM', r'GOMITA', r'BANANITA', r'TRULULU', r'MASMELO',
        r'GELATINA DE PATA', r'BOCADILLO VELEÑO', r'TRIDENT', r'HALLS', r'DULCES',
        r'PERAS DE DULCE', r'PAN TAJADO', r'PAN ARTESANAL', r'PAN ROLLO', r'TOSTADOS',
        r'SANÍN', r'LA GITANA', r'BIMBO', r'RAMO', r'TORTA', r'AREQUIPE'
    ]),

    # 5. Snacks y Pasabocas
    ('Snacks y Pasabocas', [
        r'DORITOS', r'DE TODITO', r'CHOCLITOS', r'CHEETOS', r'CHEEZ TRIS', r'PAPAS MARGARITA',
        r'PAPAS RIZADAS', r'NATUCHIPS', r'PLATANITOS', r'TOCINETAS', r'YUPI', r'TOSTI EMPANADAS',
        r'PALOMITAS', r'PICADAS', r'ROSQUILLAS', r'AREPAS', r'TAKIS', r'MANÍ MOTO', r'MANÍ MIX'
    ]),

    # 6. Farmacia y Botiquín
    ('Farmacia y Botiquín', [
        r'NOXPIRIN', r'PASTILLAS VICK', r'GASTRUM', r'DOLEX', r'NORAVER', r'DURAFLEX', r'IBUFLASH', r'MAREOL',
        r'LOMOTIL', r'COLIK FORTE', r'LORATADINA', r'APRONAX', r'ASPIRINETA', r'ASPIRINA', r'LUMBAL',
        r'BUSCAPINA', r'ALKA-SELTZER', r'SEVEDOL', r'CALMIDOL', r'VITAFEN', r'X-RAY', r'ADVIL',
        r'ACETAMINOFÉN', r'SAL DE FRUTAS', r'BONFIEST', r'AMOXICILINA', r'IBUPROFENO', r'OMEPRAZOL',
        r'CURAS', r'VAPORUB', r'JERINGA', r'ESPARADRAPO', r'MICROPORE', r'ALCOHOL', r'ALGODÓN',
        r'GASA', r'TAPABOCAS', r'GUANTES DE LÁTEX', r'PRESERVATIVOS', r'CONDONES'
    ]),

    # 7. Papelería, Escolar y Oficina
    ('Papelería, Escolar y Oficina', [
        r'CUADERNO', r'BLOCK', r'HOJA DE BLOCK', r'SOBRE DE MANILA', r'BOLÍGRAFO', r'LÁPIZ GRAFITO',
        r'MARCADOR', r'SHARPIE', r'MICRO-PUNTA', r'COLORES ESCOLARES', r'CRAYOLAS', r'PEGANTE',
        r'EGA', r'GLUE STICK', r'SILICONA', r'CINTA DE ENMASCARAR', r'CINTA TRANSPARENTE',
        r'BORRADOR', r'SACAPUNTAS', r'TIJERAS ESCOLARES', r'BISTURÍ', r'COMPÁS', r'TRANSPORTADOR',
        r'TÉMPERAS', r'VINILO', r'PINCEL ARTÍSTICO', r'TIZAS', r'FOMMY', r'ESCARCHA', r'CLIPS',
        r'TALONARIO', r'FACTURERO', r'RECIBOS DE CAJA', r'RIFAS', r'HOJA DE VIDA',
        r'CONTRATO DE ARRENDAMIENTO', r'LETRA DE CAMBIO', r'CORRECTOR LÍQUIDO'
    ]),

    # 8. Ferretería, Hogar y Miscelánea
    ('Ferretería, Hogar y Miscelánea', [
        r'BOMBILLO', r'TOMACORRIENTE', r'PILAS', r'DURACELL', r'ENERGIZER', r'PILA CUADRADA',
        r'CAUCHO PARA OLLA', r'COLADOR', r'CORTINA DE BAÑO', r'ADAPTADOR TERMINAL PVC',
        r'SOPORTE / BASE PARA CELULAR', r'ALCANCÍA', r'ENCENDEDOR', r'CANDELA', r'FÓSFOROS',
        r'VELAS', r'CANDADO', r'CINTA AISLANTE', r'CINTA DE TEFLÓN', r'ACEITE 3 EN UNO',
        r'BETÚN', r'PALILLOS DE DIENTES', r'PALOS PARA PALETA', r'PALOS PARA PINCHO',
        r'HILO DE COSER', r'BOMBAS / GLOBOS', r'TIRAS TRANSPARENTES', r'BOLSA PLÁSTICA',
        r'BOLSA PARA BASURA', r'BOLSA INDUSTRIAL', r'PLATOS DESECHABLES', r'VASOS DESECHABLES',
        r'TARROS / ENVASES', r'CIGARRILLOS'
    ]),

    # 9. Cuidado Personal y Cosméticos
    ('Cuidado Personal y Cosméticos', [
        r'SHAMPOO', r'SAVITAL', r'NUTRIBELLA', r'PANTENE', r'HEAD & SHOULDERS', r'DOVE', r'TRATAMIENTO',
        r'AFEITAR', r'GILLETTE', r'SCHICK', r'MINORA', r'DORCO', r'CUCHILLA',
        r'JABÓN DE BAÑO', r'JABÓN ANTIBACTERIAL', r'PROTEX', r'PALMOLIVE', r'REXONA', r'LUX', r'DESEO', r'CRISTALINO',
        r'JABÓN ÍNTIMO', r'DESODORANTE', r'YODORA', r'LADY SPEED', r'BALANCE',
        r'CREMA DENTAL', r'COLGATE', r'FLUOCARDENT', r'FORTIDENT', r'CEPILLO DENTAL', r'SEDA DENTAL',
        r'TOALLAS NOSOTRAS', r'TOALLAS HIGIÉNICAS', r'PROTECTOR', r'TAMPÓN', r'PAÑAL', r'PAÑITOS HÚMEDOS',
        r'GEL FIJADOR', r'CERA CAPILAR', r'CREMA PARA PEINAR', r'ARGÁN', r'ALMENDRAS', r'ESMALTE',
        r'REMOVEDOR', r'LIMA', r'CORTAÚÑAS', r'CORTACUTÍCULAS', r'DELINEADOR', r'PERFILADOR',
        r'BRILLO LABIAL', r'UÑAS POSTIZAS', r'CUBRECANAS', r'TINTE', r'TALCO', r'MEXSANA',
        r'VASELINA', r'PONDS', r'LUBRIDERM', r'PEINILLA', r'PEINE', r'MOÑAS', r'CAUCHOS CABELLO',
        r'PINZAS', r'COPITOS', r'GUANTE EXFOLIANTE', r'LIJA PARA PIES', r'ACEITE PARA BEBÉ'
    ]),

    # 10. Aseo del Hogar y Lavandería
    ('Aseo del Hogar y Lavandería', [
        r'PAPEL HIGIÉNICO', r'SERVILLETAS', r'TOALLA DE COCINA', r'DETERGENTE', r'ARIEL', r'DERSA',
        r'RINDEX', r'3D MULTIUSOS', r'FAB', r'WOOLITE', r'JABÓN DE LAVAR', r'REY', r'VEL ROSITA',
        r'SUPREMO', r'FAMA', r'BLANQUEADOR', r'LÍMPIDO', r'VANISH', r'SUAVIZANTE', r'SUAVITEL',
        r'DESINFECTANTE', r'FABULOSO', r'SANPIC', r'SÚPER RIEL', r'CREOLINA', r'CERA LÍQUIDA',
        r'LAVALOZA', r'AXION', r'MI DÍA', r'LA JOYA', r'LIMPIA VIDRIOS', r'ESPONJA', r'SABRA',
        r'COLIBRÍ', r'BOMBRIL', r'INSECTICIDA', r'RAID', r'PAPEL ALUMINIO', r'GUANTES DE CAUCHO'
    ]),

    # 11. Bebidas y Refrescos
    ('Bebidas y Refrescos', [
        r'GASEOSA', r'COCA-COLA', r'CUATRO', r'SPRITE', r'PREMIO', r'BIG COLA', r'PEPSI', r'POSTOBÓN',
        r'AGUA', r'CRISTAL', r'H2OH', r'SODA BRETAÑA', r'JUGO', r'CIFRUT', r'HIT', r'SUERO',
        r'ELECTROLIT', r'PEDIALYTE', r'GATORLYTE', r'GATORADE', r'SPORADE', r'ENERGIZANTE',
        r'VIVE 100', r'AMPER', r'ESPARTA', r'SPEED MAX', r'PONY MALTA'
    ]),

    # 12. Lácteos, Huevos y Refrigerados
    ('Lácteos, Huevos y Refrigerados', [
        r'LECHE', r'LECHERITA', r'KLIM', r'RODEO', r'ALQUERÍA', r'SAN FERNANDO', r'COLANTA',
        r'MANTEQUILLA', r'CREMA DE LECHE', r'QUESO', r'CUAJADA', r'PARMESANO', r'COSTEÑO',
        r'YOGURT', r'YOGO YOGO', r'BON YURT', r'HUEVO', r'PULPA DE FRUTA', r'GELATINA EN VASO',
        r'AVENA ALPINA', r'AVENA EN BOLSA'
    ]),

    # 13. Abarrotes y Despensa
    ('Abarrotes y Despensa', [
        r'ARROZ', r'FRÍJOL', r'LENTEJAS', r'ACEITE FRITÓN', r'HARINA', r'ESPAGUETI', r'PASTA LA MUÑECA',
        r'CAFÉ', r'CHOCOLATE DE MESA', r'CHOCOLISTO', r'MILO EN POLVO', r'AZÚCAR', r'SAL',
        r'PANELA', r'ATÚN', r'SARDINAS', r'MAÍZ TIERNO', r'ARVEJA', r'SALSA DE TOMATE', r'MAYONESA',
        r'MOSTAZA', r'SALSA NEGRA', r'SALSA BBQ', r'SALSA DE SOYA', r'SALSA ROSADA', r'VINAGRE',
        r'AJO', r'GUISAMAC', r'RICOSTILLA', r'MAGGI', r'LA SOPERA', r'BICARBONATO', r'POLVO PARA HORNEAR',
        r'LEVADURA', r'ESENCIAS', r'MIEL DE ABEJAS', r'REFRESCO', r'FRUTIÑO', r'PANELADA', r'SUNTI',
        r'AVENA QUAKER', r'AVENA INSTANTÁNEA', r'FARINA', r'MAIZENA', r'CEREAL ZUCARITAS', r'COMPOTA'
    ]),
]

def get_perfect_category(name):
    for cat, patterns in TAXONOMY_RULES:
        for pat in patterns:
            if re.search(pat, name, re.IGNORECASE):
                return cat
    return 'Abarrotes y Despensa'
