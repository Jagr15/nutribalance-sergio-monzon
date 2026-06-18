begin;

truncate table
  public.flujo_caja_movimientos,
  public.presupuestos_mensuales,
  public.comprobantes,
  public.stock_pt_movimientos,
  public.ordenes_expedicion,
  public.stock_pt,
  public.trazabilidad_eventos,
  public.orden_consumo_lotes,
  public.ordenes_produccion,
  public.stock_movimientos,
  public.stock_lotes_mp,
  public.formula_ingredientes,
  public.formulas,
  public.alertas_estado,
  public.categorias_financieras,
  public.plan_cuentas,
  public.centros_costo,
  public.cuentas_bancarias,
  public.formas_pago,
  public.silos,
  public.insumos,
  public.proveedores,
  public.usuarios,
  public.roles
restart identity cascade;

-- Roles y usuarios demo
insert into public.roles (code, nombre, descripcion)
values
  ('admin', 'Admin', 'Acceso total al sistema'),
  ('produccion', 'Producción', 'Operación de órdenes y trazabilidad'),
  ('inventario', 'Inventario', 'Gestión de stock y lotes'),
  ('finanzas', 'Finanzas', 'Caja, cuentas y reportes financieros'),
  ('supervisor', 'Supervisor', 'Aprobación y seguimiento operativo'),
  ('solo_lectura', 'Solo Lectura', 'Acceso de consulta')
on conflict (code) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    updated_at = now();

insert into public.usuarios (legacy_uid, role_id, nombre, email, esta_activo)
values
  ('usr-admin-demo', (select id from public.roles where code = 'admin'), 'Sergio Ramos', 'admin@nutribalance.com', true),
  ('usr-produccion-demo', (select id from public.roles where code = 'produccion'), 'Juan Pérez', 'produccion@nutribalance.com', true),
  ('usr-finanzas-demo', (select id from public.roles where code = 'finanzas'), 'Ana García', 'finanzas@nutribalance.com', true)
on conflict (legacy_uid) do update
set role_id = excluded.role_id,
    nombre = excluded.nombre,
    email = excluded.email,
    esta_activo = excluded.esta_activo,
    updated_at = now();

-- Clientes
insert into public.clientes (
  legacy_uid, nombre, razon_social, segmento, ubicacion, contacto, producto_principal,
  condicion_comercial, estado, observaciones, ultima_compra, saldo_pendiente_ars, esta_activo
)
values
  ('cli-001', 'Estancia La Esperanza', 'Estancia La Esperanza SRL', 'Tambo', 'Rafaela, Santa Fe', 'Marina Gómez · +54 3492 445112', 'Alimento Lechera', '30 días fecha factura', 'Activo', 'Cliente estable con compras quincenales.', current_date - 33, 325000, true),
  ('cli-002', 'Agropecuaria Don Sergio', 'Agropecuaria Don Sergio SAS', 'Mixto agrícola-ganadero', 'Pergamino, Buenos Aires', 'Julián Díaz · +54 2477 518223', 'Ración Recría/Engorde', '21 días', 'En riesgo', 'Cliente con tensión de cobranzas.', current_date - 40, 1185000, true),
  ('cli-003', 'Tambo San Miguel', 'Tambo San Miguel SRL', 'Tambo', 'Villa María, Córdoba', 'Natalia Ferreyra · +54 353 4869012', 'Alimento Lechera', 'Contado contra entrega', 'Activo', 'Cuenta saneada.', current_date - 31, 0, true)
on conflict (legacy_uid) do update
set nombre = excluded.nombre,
    razon_social = excluded.razon_social,
    segmento = excluded.segmento,
    ubicacion = excluded.ubicacion,
    contacto = excluded.contacto,
    producto_principal = excluded.producto_principal,
    condicion_comercial = excluded.condicion_comercial,
    estado = excluded.estado,
    observaciones = excluded.observaciones,
    ultima_compra = excluded.ultima_compra,
    saldo_pendiente_ars = excluded.saldo_pendiente_ars,
    esta_activo = excluded.esta_activo,
    updated_at = now();

-- Proveedores
insert into public.proveedores (
  legacy_uid, nombre_empresa, producto_que_provee, contacto_nombre, telefono, email, direccion, documento, esta_activo
)
values
  ('prov-agronec', 'AgroNecta S.A.', 'Maíz molido', 'Mariana López', '+54 11 5555 1001', 'compras@agronecta.com', 'Ruta 9 Km 38, Córdoba', '30-71000001-1', true),
  ('prov-sudeste-granos', 'Granos del Sudeste SRL', 'Harina de soja', 'Diego Fernández', '+54 11 5555 1002', 'ventas@granosdelsudeste.com', 'Parque Industrial, Rosario', '30-71000002-9', true),
  ('prov-nutrimix', 'Nutrimix Insumos', 'Núcleo vitamínico', 'Carla Gómez', '+54 11 5555 1003', 'contacto@nutrimix.com', 'Av. Libertad 1450, Santa Fe', '30-71000003-7', true),
  ('prov-biofeed', 'BioFeed Argentina', 'Harina de girasol', 'Jorge Silva', '+54 11 5555 1004', 'ventas@biofeed.com', 'Ruta 20 Km 12, Mendoza', '30-71000004-5', true),
  ('prov-oleaginosas', 'Oleaginosas del Plata', 'Aceite vegetal', 'Micaela Torres', '+54 11 5555 1005', 'comercial@oleaginosas.com', 'Zona Portuaria, Bahía Blanca', '30-71000005-3', true),
  ('prov-minerales', 'Minerales del Norte', 'Carbonato de calcio', 'Hernán Ríos', '+54 11 5555 1006', 'ventas@mineralesnorte.com', 'RN 34 Km 890, Tucumán', '30-71000006-1', true),
  ('prov-nucleo', 'Núcleos y Premixes SA', 'Premix mineral', 'Lucía Ferreyra', '+54 11 5555 1007', 'pedidos@nucleospremix.com', 'Parque PyME, La Plata', '30-71000007-0', true),
  ('prov-fibras', 'Fibras y Salvados SRL', 'Afrecho de trigo', 'Pablo Castro', '+54 11 5555 1008', 'ventas@fibrassalvados.com', 'Acceso Este 2300, San Juan', '30-71000008-8', true),
  ('prov-aceites', 'Aceites Vegetales del Centro', 'Melaza', 'Soledad Navarro', '+54 11 5555 1009', 'compras@aceitescentro.com', 'Ruta 11 Km 121, Entre Ríos', '30-71000009-6', true),
  ('prov-logistica', 'Logística Agro Industrial', 'Fosfato dicálcico', 'Federico Ruiz', '+54 11 5555 1010', 'operaciones@logisticaagro.com', 'Puerto Seco, Salta', '30-71000010-4', true)
on conflict (legacy_uid) do update
set nombre_empresa = excluded.nombre_empresa,
    producto_que_provee = excluded.producto_que_provee,
    contacto_nombre = excluded.contacto_nombre,
    telefono = excluded.telefono,
    email = excluded.email,
    direccion = excluded.direccion,
    documento = excluded.documento,
    esta_activo = excluded.esta_activo,
    updated_at = now();

-- Insumos
insert into public.insumos (
  legacy_uid, nombre, unidad_medida, categoria, umbral_alerta, ref_costo_unitario,
  proteina_bruta_pct, humedad_pct, fibra_pct, grasa_pct, cenizas_pct, unidad_base, observaciones, esta_activo
)
values
  ('ins-maiz-molido', 'Maiz molido', 'KG', 'Energéticos', 180, 185, 8.5000, 12.0000, 2.5000, 3.2000, 1.5000, 'KG', 'Base energética para varias fórmulas', true),
  ('ins-harina-soja', 'Harina de soja', 'KG', 'Proteicos', 140, 330, 44.0000, 12.0000, 6.0000, 2.0000, 6.5000, 'KG', 'Aporte proteico principal', true),
  ('ins-afrecho-trigo', 'Afrecho de trigo', 'KG', 'Fibra', 90, 220, 16.0000, 12.0000, 12.0000, 3.0000, 6.0000, 'KG', 'Mejora fibra y palatabilidad', true),
  ('ins-harina-girasol', 'Harina de girasol', 'KG', 'Proteicos', 80, 275, 31.0000, 10.0000, 14.0000, 2.5000, 7.0000, 'KG', 'Proteína vegetal alternativa', true),
  ('ins-carbonato-calcio', 'Carbonato de calcio', 'KG', 'Minerales', 40, 90, 0.0000, 0.0000, 0.0000, 0.0000, 56.0000, 'KG', 'Corrector mineral', true),
  ('ins-fosfato-dicalcico', 'Fosfato dicálcico', 'KG', 'Minerales', 30, 210, 0.0000, 0.0000, 0.0000, 0.0000, 18.0000, 'KG', 'Balance calcio/fósforo', true),
  ('ins-sal-mineral', 'Sal mineralizada', 'KG', 'Minerales', 20, 160, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 'KG', 'Micro minerales y sodio', true),
  ('ins-melaza', 'Melaza', 'KG', 'Energéticos', 35, 145, 4.0000, 22.0000, 0.5000, 0.0000, 8.0000, 'KG', 'Mejora consumo y energía rápida', true),
  ('ins-premix', 'Nucleo vitaminico', 'KG', 'Aditivos', 15, 950, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 'KG', 'Premix concentrado para arranque', true),
  ('ins-aceite-veg', 'Aceite vegetal', 'KG', 'Energéticos', 25, 420, 0.0000, 0.0000, 0.0000, 100.0000, 0.0000, 'KG', 'Fuente energética de alta densidad', true)
on conflict (legacy_uid) do update
set nombre = excluded.nombre,
    unidad_medida = excluded.unidad_medida,
    categoria = excluded.categoria,
    umbral_alerta = excluded.umbral_alerta,
    ref_costo_unitario = excluded.ref_costo_unitario,
    proteina_bruta_pct = excluded.proteina_bruta_pct,
    humedad_pct = excluded.humedad_pct,
    fibra_pct = excluded.fibra_pct,
    grasa_pct = excluded.grasa_pct,
    cenizas_pct = excluded.cenizas_pct,
    unidad_base = excluded.unidad_base,
    observaciones = excluded.observaciones,
    esta_activo = excluded.esta_activo,
    updated_at = now();

-- Silos
insert into public.silos (legacy_uid, nombre, descripcion, esta_activo)
values
  ('silo-c1', 'Silo C1', 'Silo principal para alimento balanceado', true),
  ('silo-c2', 'Silo C2', 'Silo de contingencia para terminados', true),
  ('silo-bolsa', 'Silo Bolsa', 'Zona de resguardo temporal', true),
  ('silo-pto', 'Silo PTO', 'Salida de despacho y transferencia', true)
on conflict (legacy_uid) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    esta_activo = excluded.esta_activo,
    updated_at = now();

-- Plan contable y finanzas operativas
insert into public.plan_cuentas (codigo, nombre, tipo, naturaleza)
values
  ('1001', 'Caja y Bancos', 'ACTIVO', 'DEUDORA'),
  ('1101', 'Cuentas por Cobrar', 'ACTIVO', 'DEUDORA'),
  ('2001', 'Cuentas por Pagar', 'PASIVO', 'ACREEDORA'),
  ('4001', 'Ventas de Producto Terminado', 'INGRESO', 'ACREEDORA'),
  ('5001', 'Compras de Materia Prima', 'EGRESO', 'DEUDORA'),
  ('5002', 'Gastos Operativos', 'EGRESO', 'DEUDORA')
on conflict (codigo) do update
set nombre = excluded.nombre,
    tipo = excluded.tipo,
    naturaleza = excluded.naturaleza,
    updated_at = now();

insert into public.categorias_financieras (legacy_uid, nombre, tipo_movimiento, area, plan_cuenta_id)
values
  ('cat-ventas', 'Ventas PT', 'INGRESO', 'ventas', (select id from public.plan_cuentas where codigo = '4001')),
  ('cat-compras', 'Compras MP', 'EGRESO', 'compras', (select id from public.plan_cuentas where codigo = '5001')),
  ('cat-logistica', 'Logistica y Flete', 'EGRESO', 'operaciones', (select id from public.plan_cuentas where codigo = '5002')),
  ('cat-cobranzas', 'Cobranzas', 'INGRESO', 'cobranzas', (select id from public.plan_cuentas where codigo = '1101')),
  ('cat-transferencias', 'Transferencias Internas', 'TRANSFERENCIA', 'tesoreria', (select id from public.plan_cuentas where codigo = '1001'))
on conflict (legacy_uid) do update
set nombre = excluded.nombre,
    tipo_movimiento = excluded.tipo_movimiento,
    area = excluded.area,
    plan_cuenta_id = excluded.plan_cuenta_id,
    updated_at = now();

insert into public.centros_costo (legacy_uid, nombre, descripcion)
values
  ('cc-planta', 'Planta', 'Costos de planta y producción'),
  ('cc-logistica', 'Logistica', 'Fletes y distribución'),
  ('cc-administracion', 'Administracion', 'Costos administrativos')
on conflict (legacy_uid) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    updated_at = now();

insert into public.cuentas_bancarias (legacy_uid, banco, alias, cbu, moneda, saldo_actual)
values
  ('cb-main', 'Banco Provincia', 'Cuenta Operativa', '0140000000000000000000', 'ARS', 1250000.00),
  ('cb-reserva', 'Banco Nación', 'Cuenta Reserva', '0110000000000000000000', 'ARS', 540000.00),
  ('cb-cobros', 'Mercado Pago', 'Cobros PyME', '9990000000000000000000', 'ARS', 185000.00)
on conflict (legacy_uid) do update
set banco = excluded.banco,
    alias = excluded.alias,
    cbu = excluded.cbu,
    moneda = excluded.moneda,
    saldo_actual = excluded.saldo_actual,
    updated_at = now();

insert into public.formas_pago (legacy_uid, nombre, tipo, dias_plazo)
values
  ('fp-efectivo', 'Efectivo', 'EFECTIVO', 0),
  ('fp-transferencia', 'Transferencia', 'TRANSFERENCIA', 0),
  ('fp-cheque-30', 'Cheque 30 dias', 'CHEQUE', 30),
  ('fp-cta-cte', 'Cuenta Corriente', 'CTA_CTE', 15)
on conflict (legacy_uid) do update
set nombre = excluded.nombre,
    tipo = excluded.tipo,
    dias_plazo = excluded.dias_plazo,
    updated_at = now();

-- Fórmulas
insert into public.formulas (
  legacy_uid, nombre_producto, version, esta_activa, ultima_edicion, id_usuario, author,
  proteina_calculada_pct, costo_total, costo_por_kg, costo_por_tonelada,
  advertencias_nutricionales, advertencias_costos
)
values
  ('form-lechera-premium', 'Alimento Lechera Premium', 1, true, now() - interval '18 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'Sergio Ramos', 16.2500, 261.750000, 261.750000, 261750.000000, '[]'::jsonb, '[]'::jsonb),
  ('form-pellet-crecimiento', 'Pellet Crecimiento', 2, true, now() - interval '15 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'Sergio Ramos', 18.4000, 249.750000, 249.750000, 249750.000000, '[]'::jsonb, '[]'::jsonb),
  ('form-recria-balance', 'Recria Balance', 1, true, now() - interval '12 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'Sergio Ramos', 17.9000, 273.250000, 273.250000, 273250.000000, '[]'::jsonb, '[]'::jsonb),
  ('form-nucleo-inicio', 'Nucleo Inicio', 1, true, now() - interval '10 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'Sergio Ramos', 19.1000, 323.000000, 323.000000, 323000.000000, '[]'::jsonb, '[]'::jsonb),
  ('form-engorde-plus', 'Engorde Plus', 3, true, now() - interval '8 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'Sergio Ramos', 15.8000, 229.250000, 229.250000, 229250.000000, '[]'::jsonb, '[]'::jsonb)
on conflict (legacy_uid) do update
set nombre_producto = excluded.nombre_producto,
    version = excluded.version,
    esta_activa = excluded.esta_activa,
    ultima_edicion = excluded.ultima_edicion,
    id_usuario = excluded.id_usuario,
    author = excluded.author,
    proteina_calculada_pct = excluded.proteina_calculada_pct,
    costo_total = excluded.costo_total,
    costo_por_kg = excluded.costo_por_kg,
    costo_por_tonelada = excluded.costo_por_tonelada,
    advertencias_nutricionales = excluded.advertencias_nutricionales,
    advertencias_costos = excluded.advertencias_costos,
    updated_at = now();

insert into public.formula_ingredientes (
  formula_id, insumo_id, nombre_insumo, porcentaje, orden,
  aporte_proteina_pct, aporte_proteina_g_kg, costo_unitario_usado, costo_contribucion_kg, fuente_costo
)
values
  ((select id from public.formulas where legacy_uid = 'form-lechera-premium'), (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'Maiz molido', 45.0000, 1, 3.825000, 38.250000, 185.000000, 83.250000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-lechera-premium'), (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'Harina de soja', 25.0000, 2, 11.000000, 110.000000, 330.000000, 82.500000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-lechera-premium'), (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), 'Afrecho de trigo', 20.0000, 3, 3.200000, 32.000000, 220.000000, 44.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-lechera-premium'), (select id from public.insumos where legacy_uid = 'ins-carbonato-calcio'), 'Carbonato de calcio', 5.0000, 4, 0.000000, 0.000000, 90.000000, 4.500000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-lechera-premium'), (select id from public.insumos where legacy_uid = 'ins-premix'), 'Nucleo vitaminico', 5.0000, 5, 0.000000, 0.000000, 950.000000, 47.500000, 'REFERENCIA'),

  ((select id from public.formulas where legacy_uid = 'form-pellet-crecimiento'), (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'Maiz molido', 40.0000, 1, 3.400000, 34.000000, 185.000000, 74.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-pellet-crecimiento'), (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'Harina de soja', 30.0000, 2, 13.200000, 132.000000, 330.000000, 99.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-pellet-crecimiento'), (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), 'Harina de girasol', 15.0000, 3, 4.650000, 46.500000, 275.000000, 41.250000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-pellet-crecimiento'), (select id from public.insumos where legacy_uid = 'ins-melaza'), 'Melaza', 10.0000, 4, 0.400000, 4.000000, 145.000000, 14.500000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-pellet-crecimiento'), (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), 'Aceite vegetal', 5.0000, 5, 0.000000, 0.000000, 420.000000, 21.000000, 'REFERENCIA'),

  ((select id from public.formulas where legacy_uid = 'form-recria-balance'), (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'Maiz molido', 35.0000, 1, 2.975000, 29.750000, 185.000000, 64.750000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-recria-balance'), (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'Harina de soja', 30.0000, 2, 13.200000, 132.000000, 330.000000, 99.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-recria-balance'), (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), 'Afrecho de trigo', 15.0000, 3, 2.400000, 24.000000, 220.000000, 33.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-recria-balance'), (select id from public.insumos where legacy_uid = 'ins-fosfato-dicalcico'), 'Fosfato dicálcico', 10.0000, 4, 0.000000, 0.000000, 210.000000, 21.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-recria-balance'), (select id from public.insumos where legacy_uid = 'ins-sal-mineral'), 'Sal mineralizada', 5.0000, 5, 0.000000, 0.000000, 160.000000, 8.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-recria-balance'), (select id from public.insumos where legacy_uid = 'ins-premix'), 'Nucleo vitaminico', 5.0000, 6, 0.000000, 0.000000, 950.000000, 47.500000, 'REFERENCIA'),

  ((select id from public.formulas where legacy_uid = 'form-nucleo-inicio'), (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'Maiz molido', 50.0000, 1, 4.250000, 42.500000, 185.000000, 92.500000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-nucleo-inicio'), (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'Harina de soja', 20.0000, 2, 8.800000, 88.000000, 330.000000, 66.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-nucleo-inicio'), (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), 'Harina de girasol', 10.0000, 3, 3.100000, 31.000000, 275.000000, 27.500000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-nucleo-inicio'), (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), 'Aceite vegetal', 10.0000, 4, 0.000000, 0.000000, 420.000000, 42.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-nucleo-inicio'), (select id from public.insumos where legacy_uid = 'ins-premix'), 'Nucleo vitaminico', 10.0000, 5, 0.000000, 0.000000, 950.000000, 95.000000, 'REFERENCIA'),

  ((select id from public.formulas where legacy_uid = 'form-engorde-plus'), (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'Maiz molido', 30.0000, 1, 2.550000, 25.500000, 185.000000, 55.500000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-engorde-plus'), (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'Harina de soja', 25.0000, 2, 11.000000, 110.000000, 330.000000, 82.500000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-engorde-plus'), (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), 'Afrecho de trigo', 20.0000, 3, 3.200000, 32.000000, 220.000000, 44.000000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-engorde-plus'), (select id from public.insumos where legacy_uid = 'ins-melaza'), 'Melaza', 15.0000, 4, 0.600000, 6.000000, 145.000000, 21.750000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-engorde-plus'), (select id from public.insumos where legacy_uid = 'ins-carbonato-calcio'), 'Carbonato de calcio', 5.0000, 5, 0.000000, 0.000000, 90.000000, 4.500000, 'REFERENCIA'),
  ((select id from public.formulas where legacy_uid = 'form-engorde-plus'), (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), 'Aceite vegetal', 5.0000, 6, 0.000000, 0.000000, 420.000000, 21.000000, 'REFERENCIA');

-- Stock MP y compras
insert into public.stock_lotes_mp (
  legacy_uid, insumo_id, proveedor_id, lote, remito_nro, ubicacion,
  cantidad_inicial, cantidad_actual, cantidad_comprometida,
  costo_unitario, costo_total, fecha_ingreso, id_usuario
)
values
  ('lot-maiz-2026-01', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-agronec'), 'MZ-2601-01', 'R-2601-11', 'Depósito A1', 450, 450, 30, 185, 83250, now() - interval '45 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-maiz-2026-02', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-sudeste-granos'), 'MZ-2601-02', 'R-2601-19', 'Depósito A2', 220, 220, 20, 190, 41800, now() - interval '39 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-maiz-2026-03', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-nutrimix'), 'MZ-2602-03', 'R-2602-07', 'Depósito A3', 700, 700, 80, 188, 131600, now() - interval '14 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-soja-2026-01', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), (select id from public.proveedores where legacy_uid = 'prov-biofeed'), 'SJ-2601-01', 'R-2601-21', 'Depósito B1', 400, 400, 50, 330, 132000, now() - interval '44 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-soja-2026-02', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), (select id from public.proveedores where legacy_uid = 'prov-oleaginosas'), 'SJ-2602-02', 'R-2602-09', 'Depósito B2', 300, 300, 30, 338, 101400, now() - interval '20 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-soja-2026-03', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), (select id from public.proveedores where legacy_uid = 'prov-sudeste-granos'), 'SJ-2603-03', 'R-2603-03', 'Depósito B3', 300, 300, 40, 325, 97500, now() - interval '7 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-afrecho-2026-01', (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), (select id from public.proveedores where legacy_uid = 'prov-fibras'), 'AF-2601-01', 'R-2601-02', 'Depósito C1', 260, 260, 40, 220, 57200, now() - interval '40 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-afrecho-2026-02', (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), (select id from public.proveedores where legacy_uid = 'prov-fibras'), 'AF-2602-02', 'R-2602-11', 'Depósito C2', 120, 120, 30, 225, 27000, now() - interval '5 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-girasol-2026-01', (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), (select id from public.proveedores where legacy_uid = 'prov-oleaginosas'), 'GS-2601-01', 'R-2601-15', 'Depósito C3', 250, 250, 0, 275, 68750, now() - interval '33 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-girasol-2026-02', (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), (select id from public.proveedores where legacy_uid = 'prov-biofeed'), 'GS-2602-02', 'R-2602-08', 'Depósito C4', 120, 120, 0, 280, 33600, now() - interval '11 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-carbonato-2026-01', (select id from public.insumos where legacy_uid = 'ins-carbonato-calcio'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'CC-2601-01', 'R-2601-05', 'Depósito D1', 95, 95, 0, 90, 8550, now() - interval '30 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-fosfato-2026-01', (select id from public.insumos where legacy_uid = 'ins-fosfato-dicalcico'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'FD-2601-01', 'R-2601-08', 'Depósito D2', 60, 60, 10, 210, 12600, now() - interval '28 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-sal-2026-01', (select id from public.insumos where legacy_uid = 'ins-sal-mineral'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'SM-2601-01', 'R-2601-09', 'Depósito D3', 40, 40, 5, 160, 6400, now() - interval '26 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-melaza-2026-01', (select id from public.insumos where legacy_uid = 'ins-melaza'), (select id from public.proveedores where legacy_uid = 'prov-agronec'), 'ME-2601-01', 'R-2601-14', 'Depósito E1', 300, 300, 20, 145, 43500, now() - interval '22 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-aceite-2026-01', (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), (select id from public.proveedores where legacy_uid = 'prov-aceites'), 'AV-2601-01', 'R-2601-20', 'Depósito E2', 210, 210, 10, 420, 88200, now() - interval '16 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-premix-2026-01', (select id from public.insumos where legacy_uid = 'ins-premix'), (select id from public.proveedores where legacy_uid = 'prov-nucleo'), 'PR-2601-01', 'R-2601-24', 'Depósito F1', 70, 70, 2, 950, 66500, now() - interval '17 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-premix-2026-02', (select id from public.insumos where legacy_uid = 'ins-premix'), (select id from public.proveedores where legacy_uid = 'prov-nucleo'), 'PR-2602-02', 'R-2602-04', 'Depósito F2', 260, 260, 30, 940, 244400, now() - interval '9 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-sunflower-2026-01', (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), (select id from public.proveedores where legacy_uid = 'prov-oleaginosas'), 'GS-2603-01', 'R-2603-11', 'Depósito C5', 120, 120, 0, 285, 34200, now() - interval '4 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-maiz-2026-04', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-agronec'), 'MZ-2604-04', 'R-2604-01', 'Depósito A4', 1000, 1000, 0, 186, 186000, now() - interval '38 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-maiz-2026-05', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-sudeste-granos'), 'MZ-2605-05', 'R-2605-02', 'Depósito A5', 800, 800, 0, 184, 147200, now() - interval '34 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-maiz-2026-06', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-nutrimix'), 'MZ-2606-06', 'R-2606-03', 'Depósito A6', 600, 600, 0, 187, 112200, now() - interval '31 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-maiz-2026-07', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-agronec'), 'MZ-2607-07', 'R-2607-04', 'Depósito A7', 700, 700, 0, 188, 131600, now() - interval '28 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-maiz-2026-08', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-sudeste-granos'), 'MZ-2608-08', 'R-2608-05', 'Depósito A8', 500, 500, 0, 189, 94500, now() - interval '24 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-maiz-2026-09', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), (select id from public.proveedores where legacy_uid = 'prov-nutrimix'), 'MZ-2609-09', 'R-2609-06', 'Depósito A9', 450, 450, 0, 190, 85500, now() - interval '19 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-soja-2026-04', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), (select id from public.proveedores where legacy_uid = 'prov-biofeed'), 'SJ-2604-04', 'R-2604-04', 'Depósito B4', 700, 700, 0, 332, 232400, now() - interval '37 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-soja-2026-05', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), (select id from public.proveedores where legacy_uid = 'prov-oleaginosas'), 'SJ-2605-05', 'R-2605-05', 'Depósito B5', 650, 650, 0, 334, 217100, now() - interval '32 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-soja-2026-06', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), (select id from public.proveedores where legacy_uid = 'prov-sudeste-granos'), 'SJ-2606-06', 'R-2606-06', 'Depósito B6', 550, 550, 0, 336, 184800, now() - interval '29 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-soja-2026-07', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), (select id from public.proveedores where legacy_uid = 'prov-biofeed'), 'SJ-2607-07', 'R-2607-07', 'Depósito B7', 600, 600, 0, 338, 202800, now() - interval '25 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-soja-2026-08', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), (select id from public.proveedores where legacy_uid = 'prov-oleaginosas'), 'SJ-2608-08', 'R-2608-08', 'Depósito B8', 500, 500, 0, 330, 165000, now() - interval '18 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-afrecho-2026-03', (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), (select id from public.proveedores where legacy_uid = 'prov-fibras'), 'AF-2603-03', 'R-2603-03', 'Depósito C3', 300, 300, 0, 220, 66000, now() - interval '36 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-afrecho-2026-04', (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), (select id from public.proveedores where legacy_uid = 'prov-fibras'), 'AF-2604-04', 'R-2604-04', 'Depósito C4', 250, 250, 0, 222, 55500, now() - interval '30 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-afrecho-2026-05', (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), (select id from public.proveedores where legacy_uid = 'prov-fibras'), 'AF-2605-05', 'R-2605-05', 'Depósito C5', 220, 220, 0, 225, 49500, now() - interval '23 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-afrecho-2026-06', (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), (select id from public.proveedores where legacy_uid = 'prov-fibras'), 'AF-2606-06', 'R-2606-06', 'Depósito C6', 180, 180, 0, 224, 40320, now() - interval '15 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-melaza-2026-02', (select id from public.insumos where legacy_uid = 'ins-melaza'), (select id from public.proveedores where legacy_uid = 'prov-agronec'), 'ME-2602-02', 'R-2602-02', 'Depósito E2', 200, 200, 0, 145, 29000, now() - interval '31 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-melaza-2026-03', (select id from public.insumos where legacy_uid = 'ins-melaza'), (select id from public.proveedores where legacy_uid = 'prov-biofeed'), 'ME-2603-03', 'R-2603-03', 'Depósito E3', 180, 180, 0, 148, 26640, now() - interval '21 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-melaza-2026-04', (select id from public.insumos where legacy_uid = 'ins-melaza'), (select id from public.proveedores where legacy_uid = 'prov-agronec'), 'ME-2604-04', 'R-2604-04', 'Depósito E4', 160, 160, 0, 150, 24000, now() - interval '13 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-carbonato-2026-02', (select id from public.insumos where legacy_uid = 'ins-carbonato-calcio'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'CC-2602-02', 'R-2602-02', 'Depósito D2', 400, 400, 0, 90, 36000, now() - interval '27 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-carbonato-2026-03', (select id from public.insumos where legacy_uid = 'ins-carbonato-calcio'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'CC-2603-03', 'R-2603-03', 'Depósito D3', 300, 300, 0, 92, 27600, now() - interval '20 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-carbonato-2026-04', (select id from public.insumos where legacy_uid = 'ins-carbonato-calcio'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'CC-2604-04', 'R-2604-04', 'Depósito D4', 250, 250, 0, 91, 22750, now() - interval '12 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-aceite-2026-02', (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), (select id from public.proveedores where legacy_uid = 'prov-aceites'), 'AV-2602-02', 'R-2602-02', 'Depósito E2', 180, 180, 0, 420, 75600, now() - interval '26 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-aceite-2026-03', (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), (select id from public.proveedores where legacy_uid = 'prov-aceites'), 'AV-2603-03', 'R-2603-03', 'Depósito E3', 150, 150, 0, 418, 62700, now() - interval '19 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-aceite-2026-04', (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), (select id from public.proveedores where legacy_uid = 'prov-aceites'), 'AV-2604-04', 'R-2604-04', 'Depósito E4', 140, 140, 0, 422, 59080, now() - interval '11 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-fosfato-2026-02', (select id from public.insumos where legacy_uid = 'ins-fosfato-dicalcico'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'FD-2602-02', 'R-2602-02', 'Depósito D2', 150, 150, 0, 210, 31500, now() - interval '24 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-fosfato-2026-03', (select id from public.insumos where legacy_uid = 'ins-fosfato-dicalcico'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'FD-2603-03', 'R-2603-03', 'Depósito D3', 120, 120, 0, 212, 25440, now() - interval '17 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-fosfato-2026-04', (select id from public.insumos where legacy_uid = 'ins-fosfato-dicalcico'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'FD-2604-04', 'R-2604-04', 'Depósito D4', 100, 100, 0, 208, 20800, now() - interval '10 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-sal-2026-02', (select id from public.insumos where legacy_uid = 'ins-sal-mineral'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'SM-2602-02', 'R-2602-02', 'Depósito D2', 120, 120, 0, 160, 19200, now() - interval '25 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-sal-2026-03', (select id from public.insumos where legacy_uid = 'ins-sal-mineral'), (select id from public.proveedores where legacy_uid = 'prov-minerales'), 'SM-2603-03', 'R-2603-03', 'Depósito D3', 100, 100, 0, 161, 16100, now() - interval '16 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-premix-2026-03', (select id from public.insumos where legacy_uid = 'ins-premix'), (select id from public.proveedores where legacy_uid = 'prov-nucleo'), 'PR-2603-03', 'R-2603-03', 'Depósito F3', 100, 100, 0, 940, 94000, now() - interval '14 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-premix-2026-04', (select id from public.insumos where legacy_uid = 'ins-premix'), (select id from public.proveedores where legacy_uid = 'prov-nucleo'), 'PR-2604-04', 'R-2604-04', 'Depósito F4', 80, 80, 0, 950, 76000, now() - interval '8 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo')),
  ('lot-sunflower-2026-02', (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), (select id from public.proveedores where legacy_uid = 'prov-biofeed'), 'GS-2604-02', 'R-2604-02', 'Depósito C6', 300, 300, 0, 280, 84000, now() - interval '6 days', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'))
on conflict (legacy_uid) do update
set insumo_id = excluded.insumo_id,
    proveedor_id = excluded.proveedor_id,
    lote = excluded.lote,
    remito_nro = excluded.remito_nro,
    ubicacion = excluded.ubicacion,
    cantidad_inicial = excluded.cantidad_inicial,
    cantidad_actual = excluded.cantidad_actual,
    cantidad_comprometida = excluded.cantidad_comprometida,
    costo_unitario = excluded.costo_unitario,
    costo_total = excluded.costo_total,
    fecha_ingreso = excluded.fecha_ingreso,
    id_usuario = excluded.id_usuario,
    updated_at = now();

insert into public.stock_movimientos (
  lote_id, usuario_id, tipo, origen, cantidad, observaciones, metadata
)
values
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-carbonato-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'ENTRADA', 'COMPRA', 20, 'Recepcion lote carbonato demo', jsonb_build_object('orden_id', null, 'orden_legacy_uid', null, 'proveedor', 'prov-minerales')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-sal-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'ENTRADA', 'COMPRA', 10, 'Recepcion lote sal demo', jsonb_build_object('orden_id', null, 'orden_legacy_uid', null, 'proveedor', 'prov-minerales')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'ENTRADA', 'COMPRA', 50, 'Recepcion lote soja demo', jsonb_build_object('orden_id', null, 'orden_legacy_uid', null, 'proveedor', 'prov-biofeed'))
;

-- Órdenes de producción
insert into public.ordenes_produccion (
  legacy_uid, lote, formula_id, id_formula_legacy, nombre_producto, version_formula,
  cantidad_objetivo, cantidad_real, merma_manual, silo_id, id_silo_legacy, destino_silo,
  estado, fecha_creacion, usuario_responsable, usuario_id, costo_total_insumos
)
values
  ('op-demo-001', 'OP-2026-000001', (select id from public.formulas where legacy_uid = 'form-lechera-premium'), 'form-lechera-premium', 'Alimento Lechera Premium', 1, 650, null, null, null, null, null, 'PENDIENTE', now() - interval '9 days', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 0),
  ('op-demo-002', 'OP-2026-000002', (select id from public.formulas where legacy_uid = 'form-pellet-crecimiento'), 'form-pellet-crecimiento', 'Pellet Crecimiento', 2, 700, null, null, null, null, null, 'PENDIENTE', now() - interval '8 days', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 0),
  ('op-demo-003', 'OP-2026-000003', (select id from public.formulas where legacy_uid = 'form-recria-balance'), 'form-recria-balance', 'Recria Balance', 1, 500, null, null, null, null, null, 'EN PROCESO', now() - interval '6 days', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 0),
  ('op-demo-004', 'OP-2026-000004', (select id from public.formulas where legacy_uid = 'form-nucleo-inicio'), 'form-nucleo-inicio', 'Nucleo Inicio', 1, 550, null, null, null, null, null, 'EN PROCESO', now() - interval '5 days', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 0),
  ('op-demo-005', 'OP-2026-000005', (select id from public.formulas where legacy_uid = 'form-lechera-premium'), 'form-lechera-premium', 'Alimento Lechera Premium', 1, 600, 600, 12, (select id from public.silos where legacy_uid = 'silo-c1'), 'silo-c1', 'Silo C1', 'FINALIZADO', now() - interval '4 days', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 210100),
  ('op-demo-006', 'OP-2026-000006', (select id from public.formulas where legacy_uid = 'form-pellet-crecimiento'), 'form-pellet-crecimiento', 'Pellet Crecimiento', 2, 650, 650, 10, (select id from public.silos where legacy_uid = 'silo-c2'), 'silo-c2', 'Silo C2', 'FINALIZADO', now() - interval '3 days', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 233850),
  ('op-demo-007', 'OP-2026-000007', (select id from public.formulas where legacy_uid = 'form-recria-balance'), 'form-recria-balance', 'Recria Balance', 1, 500, 500, 8, (select id from public.silos where legacy_uid = 'silo-bolsa'), 'silo-bolsa', 'Silo Bolsa', 'FINALIZADO', now() - interval '2 days', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 188850),
  ('op-demo-008', 'OP-2026-000008', (select id from public.formulas where legacy_uid = 'form-nucleo-inicio'), 'form-nucleo-inicio', 'Nucleo Inicio', 1, 550, 550, 15, (select id from public.silos where legacy_uid = 'silo-pto'), 'silo-pto', 'Silo PTO', 'FINALIZADO', now() - interval '1 day', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 255750),
  ('op-demo-009', 'OP-2026-000009', (select id from public.formulas where legacy_uid = 'form-engorde-plus'), 'form-engorde-plus', 'Engorde Plus', 3, 480, null, null, null, null, null, 'PENDIENTE', now() - interval '1 day' + interval '3 hours', 'Sergio Ramos', (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 0)
on conflict (legacy_uid) do update
set lote = excluded.lote,
    formula_id = excluded.formula_id,
    id_formula_legacy = excluded.id_formula_legacy,
    nombre_producto = excluded.nombre_producto,
    version_formula = excluded.version_formula,
    cantidad_objetivo = excluded.cantidad_objetivo,
    cantidad_real = excluded.cantidad_real,
    merma_manual = excluded.merma_manual,
    silo_id = excluded.silo_id,
    id_silo_legacy = excluded.id_silo_legacy,
    destino_silo = excluded.destino_silo,
    estado = excluded.estado,
    fecha_creacion = excluded.fecha_creacion,
    usuario_responsable = excluded.usuario_responsable,
    usuario_id = excluded.usuario_id,
    costo_total_insumos = excluded.costo_total_insumos,
    updated_at = now();

insert into public.orden_consumo_lotes (
  orden_id, lote_id, id_lote_legacy, insumo_id, id_insumo_legacy, nombre_insumo,
  cantidad_usada, tipo_unidad, costo_unitario, costo_total
)
values
  -- OP Demo 005
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), 'lot-maiz-2026-03', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'ins-maiz-molido', 'Maiz molido', 250, 'KG', 188, 47000),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-01'), 'lot-soja-2026-01', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'ins-harina-soja', 'Harina de soja', 150, 'KG', 330, 49500),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-afrecho-2026-01'), 'lot-afrecho-2026-01', (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), 'ins-afrecho-trigo', 'Afrecho de trigo', 120, 'KG', 220, 26400),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-carbonato-2026-01'), 'lot-carbonato-2026-01', (select id from public.insumos where legacy_uid = 'ins-carbonato-calcio'), 'ins-carbonato-calcio', 'Carbonato de calcio', 30, 'KG', 90, 2700),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-02'), 'lot-premix-2026-02', (select id from public.insumos where legacy_uid = 'ins-premix'), 'ins-premix', 'Nucleo vitaminico', 50, 'KG', 940, 47000),

  -- OP Demo 006
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), 'lot-maiz-2026-03', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'ins-maiz-molido', 'Maiz molido', 230, 'KG', 188, 43240),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-03'), 'lot-soja-2026-03', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'ins-harina-soja', 'Harina de soja', 180, 'KG', 325, 58500),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-girasol-2026-01'), 'lot-girasol-2026-01', (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), 'ins-harina-girasol', 'Harina de girasol', 90, 'KG', 275, 24750),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-melaza-2026-01'), 'lot-melaza-2026-01', (select id from public.insumos where legacy_uid = 'ins-melaza'), 'ins-melaza', 'Melaza', 60, 'KG', 145, 8700),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-aceite-2026-01'), 'lot-aceite-2026-01', (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), 'ins-aceite-veg', 'Aceite vegetal', 90, 'KG', 420, 37800),

  -- OP Demo 007
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-01'), 'lot-maiz-2026-01', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'ins-maiz-molido', 'Maiz molido', 160, 'KG', 185, 29600),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-03'), 'lot-soja-2026-03', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'ins-harina-soja', 'Harina de soja', 150, 'KG', 338, 50700),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-afrecho-2026-02'), 'lot-afrecho-2026-02', (select id from public.insumos where legacy_uid = 'ins-afrecho-trigo'), 'ins-afrecho-trigo', 'Afrecho de trigo', 70, 'KG', 225, 15750),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-fosfato-2026-01'), 'lot-fosfato-2026-01', (select id from public.insumos where legacy_uid = 'ins-fosfato-dicalcico'), 'ins-fosfato-dicalcico', 'Fosfato dicálcico', 50, 'KG', 210, 10500),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-sal-2026-01'), 'lot-sal-2026-01', (select id from public.insumos where legacy_uid = 'ins-sal-mineral'), 'ins-sal-mineral', 'Sal mineralizada', 20, 'KG', 160, 3200),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-02'), 'lot-premix-2026-02', (select id from public.insumos where legacy_uid = 'ins-premix'), 'ins-premix', 'Nucleo vitaminico', 50, 'KG', 940, 47000),

  -- OP Demo 008
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-01'), 'lot-maiz-2026-01', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'ins-maiz-molido', 'Maiz molido', 200, 'KG', 185, 37000),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-01'), 'lot-soja-2026-01', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'ins-harina-soja', 'Harina de soja', 120, 'KG', 330, 39600),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-girasol-2026-01'), 'lot-girasol-2026-01', (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), 'ins-harina-girasol', 'Harina de girasol', 70, 'KG', 275, 19250),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-aceite-2026-01'), 'lot-aceite-2026-01', (select id from public.insumos where legacy_uid = 'ins-aceite-veg'), 'ins-aceite-veg', 'Aceite vegetal', 60, 'KG', 420, 25200),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-02'), 'lot-premix-2026-02', (select id from public.insumos where legacy_uid = 'ins-premix'), 'ins-premix', 'Nucleo vitaminico', 100, 'KG', 940, 94000),

  -- OP Demo 001 / 002 / 003 / 004 / 009 reservas demo
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-001'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-02'), 'lot-maiz-2026-02', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'ins-maiz-molido', 'Maiz molido', 90, 'KG', 190, 17100),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-001'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-02'), 'lot-soja-2026-02', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'ins-harina-soja', 'Harina de soja', 50, 'KG', 338, 16900),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-001'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-01'), 'lot-premix-2026-01', (select id from public.insumos where legacy_uid = 'ins-premix'), 'ins-premix', 'Nucleo vitaminico', 25, 'KG', 950, 23750),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-002'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-02'), 'lot-maiz-2026-02', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'ins-maiz-molido', 'Maiz molido', 60, 'KG', 190, 11400),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-002'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-melaza-2026-01'), 'lot-melaza-2026-01', (select id from public.insumos where legacy_uid = 'ins-melaza'), 'ins-melaza', 'Melaza', 35, 'KG', 145, 5075),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-003'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-02'), 'lot-maiz-2026-02', (select id from public.insumos where legacy_uid = 'ins-maiz-molido'), 'ins-maiz-molido', 'Maiz molido', 60, 'KG', 190, 11400),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-003'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-02'), 'lot-soja-2026-02', (select id from public.insumos where legacy_uid = 'ins-harina-soja'), 'ins-harina-soja', 'Harina de soja', 40, 'KG', 338, 13520),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-004'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-girasol-2026-02'), 'lot-girasol-2026-02', (select id from public.insumos where legacy_uid = 'ins-harina-girasol'), 'ins-harina-girasol', 'Harina de girasol', 55, 'KG', 280, 15400),
  ((select id from public.ordenes_produccion where legacy_uid = 'op-demo-009'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-01'), 'lot-premix-2026-01', (select id from public.insumos where legacy_uid = 'ins-premix'), 'ins-premix', 'Nucleo vitaminico', 30, 'KG', 950, 28500)
;

-- Finalización de las órdenes que alimentan stock PT y trazabilidad
insert into public.stock_pt (
  legacy_uid, orden_id, id_orden_legacy, numero_orden, nombre_producto, cantidad_total, cantidad_inicial,
  costo_unitario_estimado, lote, unidad_medida, estado, silo_id, id_silo_legacy, nombre_silo, detalle_insumos, fecha_ingreso, usuario
)
values
  ('pt-demo-005', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), 'op-demo-005', 'OP-2026-000005', 'Alimento Lechera Premium', 600, 600, 350.000000, 'PT-2604-01', 'KG', 'OK', (select id from public.silos where legacy_uid = 'silo-c1'), 'silo-c1', 'Silo C1', jsonb_build_array(
    jsonb_build_object('insumo', 'Maiz molido', 'lote_mp', 'lot-maiz-2026-03', 'cantidad', 250, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Harina de soja', 'lote_mp', 'lot-soja-2026-01', 'cantidad', 150, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Afrecho de trigo', 'lote_mp', 'lot-afrecho-2026-01', 'cantidad', 120, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Carbonato de calcio', 'lote_mp', 'lot-carbonato-2026-01', 'cantidad', 30, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Nucleo vitaminico', 'lote_mp', 'lot-premix-2026-02', 'cantidad', 50, 'unidad', 'KG')
  ), now() - interval '4 days', 'Sergio Ramos'),
  ('pt-demo-006', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), 'op-demo-006', 'OP-2026-000006', 'Pellet Crecimiento', 650, 650, 360.000000, 'PT-2604-02', 'KG', 'OK', (select id from public.silos where legacy_uid = 'silo-c2'), 'silo-c2', 'Silo C2', jsonb_build_array(
    jsonb_build_object('insumo', 'Maiz molido', 'lote_mp', 'lot-maiz-2026-03', 'cantidad', 230, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Harina de soja', 'lote_mp', 'lot-soja-2026-03', 'cantidad', 180, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Harina de girasol', 'lote_mp', 'lot-girasol-2026-01', 'cantidad', 90, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Melaza', 'lote_mp', 'lot-melaza-2026-01', 'cantidad', 60, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Aceite vegetal', 'lote_mp', 'lot-aceite-2026-01', 'cantidad', 90, 'unidad', 'KG')
  ), now() - interval '3 days', 'Sergio Ramos'),
  ('pt-demo-007', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), 'op-demo-007', 'OP-2026-000007', 'Recria Balance', 500, 500, 340.000000, 'PT-2604-03', 'KG', 'OK', (select id from public.silos where legacy_uid = 'silo-bolsa'), 'silo-bolsa', 'Silo Bolsa', jsonb_build_array(
    jsonb_build_object('insumo', 'Maiz molido', 'lote_mp', 'lot-maiz-2026-01', 'cantidad', 160, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Harina de soja', 'lote_mp', 'lot-soja-2026-02', 'cantidad', 150, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Afrecho de trigo', 'lote_mp', 'lot-afrecho-2026-02', 'cantidad', 70, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Fosfato dicálcico', 'lote_mp', 'lot-fosfato-2026-01', 'cantidad', 50, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Sal mineralizada', 'lote_mp', 'lot-sal-2026-01', 'cantidad', 20, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Nucleo vitaminico', 'lote_mp', 'lot-premix-2026-02', 'cantidad', 50, 'unidad', 'KG')
  ), now() - interval '2 days', 'Sergio Ramos'),
  ('pt-demo-008', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), 'op-demo-008', 'OP-2026-000008', 'Nucleo Inicio', 550, 550, 400.000000, 'PT-2604-04', 'KG', 'OK', (select id from public.silos where legacy_uid = 'silo-pto'), 'silo-pto', 'Silo PTO', jsonb_build_array(
    jsonb_build_object('insumo', 'Maiz molido', 'lote_mp', 'lot-maiz-2026-01', 'cantidad', 200, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Harina de soja', 'lote_mp', 'lot-soja-2026-01', 'cantidad', 120, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Harina de girasol', 'lote_mp', 'lot-girasol-2026-01', 'cantidad', 70, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Aceite vegetal', 'lote_mp', 'lot-aceite-2026-01', 'cantidad', 60, 'unidad', 'KG'),
    jsonb_build_object('insumo', 'Nucleo vitaminico', 'lote_mp', 'lot-premix-2026-02', 'cantidad', 100, 'unidad', 'KG')
  ), now() - interval '1 day', 'Sergio Ramos')
on conflict (legacy_uid) do update
set orden_id = excluded.orden_id,
    id_orden_legacy = excluded.id_orden_legacy,
    numero_orden = excluded.numero_orden,
    nombre_producto = excluded.nombre_producto,
    cantidad_total = excluded.cantidad_total,
    cantidad_inicial = excluded.cantidad_inicial,
    costo_unitario_estimado = excluded.costo_unitario_estimado,
    lote = excluded.lote,
    unidad_medida = excluded.unidad_medida,
    estado = excluded.estado,
    silo_id = excluded.silo_id,
    id_silo_legacy = excluded.id_silo_legacy,
    nombre_silo = excluded.nombre_silo,
    detalle_insumos = excluded.detalle_insumos,
    fecha_ingreso = excluded.fecha_ingreso,
    usuario = excluded.usuario,
    updated_at = now();

insert into public.stock_pt_movimientos (
  stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad,
  unidad, costo_unitario, valor_total, motivo, referencia, cliente_id
)
values
  ((select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'form-lechera-premium', 'Alimento Lechera Premium', 'PT-2604-01', 'OP-2026-000005', 'Silo C1', 'INGRESO', 40, 'KG', 350, 14000, 'Ingreso de lote inicial demo', 'Saldo inicial demo', null),
  ((select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'form-lechera-premium', 'Alimento Lechera Premium', 'PT-2604-01', 'OP-2026-000005', 'Silo C1', 'SALIDA', 25, 'KG', 350, 8750, 'Despacho parcial demo', 'Salida demo PT 1', (select id from public.clientes where legacy_uid = 'cli-001')),
  ((select id from public.stock_pt where legacy_uid = 'pt-demo-006'), 'form-pellet-crecimiento', 'Pellet Crecimiento', 'PT-2604-02', 'OP-2026-000006', 'Silo C2', 'SALIDA', 60, 'KG', 360, 21600, 'Despacho demo', 'Salida demo PT 2', (select id from public.clientes where legacy_uid = 'cli-002')),
  ((select id from public.stock_pt where legacy_uid = 'pt-demo-007'), 'form-recria-balance', 'Recria Balance', 'PT-2604-03', 'OP-2026-000007', 'Silo Bolsa', 'SALIDA', 35, 'KG', 340, 11900, 'Despacho demo', 'Salida demo PT 3', (select id from public.clientes where legacy_uid = 'cli-003')),
  ((select id from public.stock_pt where legacy_uid = 'pt-demo-008'), 'form-nucleo-inicio', 'Nucleo Inicio', 'PT-2604-04', 'OP-2026-000008', 'Silo PTO', 'SALIDA', 55, 'KG', 400, 22000, 'Despacho demo', 'Salida demo PT 4', (select id from public.clientes where legacy_uid = 'cli-001'));

insert into public.ordenes_expedicion (
  legacy_uid, numero_expedicion, stock_pt_id, producto_id, nombre_producto, lote_pt, cliente_id,
  presentacion, cantidad, estado, motivo, referencia
)
values
  ('exp-demo-001', 'EXP-2026-000001', (select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'form-lechera-premium', 'Alimento Lechera Premium', 'PT-2604-01', (select id from public.clientes where legacy_uid = 'cli-001'), 'GRANEL', 25, 'REGISTRADA', 'Despacho demo', 'EXP-2605-001'),
  ('exp-demo-002', 'EXP-2026-000002', (select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'form-lechera-premium', 'Alimento Lechera Premium', 'PT-2604-01', (select id from public.clientes where legacy_uid = 'cli-003'), 'BIG_BAG', 40, 'REGISTRADA', 'Despacho demo', 'EXP-2605-002'),
  ('exp-demo-003', 'EXP-2026-000003', (select id from public.stock_pt where legacy_uid = 'pt-demo-006'), 'form-pellet-crecimiento', 'Pellet Crecimiento', 'PT-2604-02', (select id from public.clientes where legacy_uid = 'cli-002'), 'BOLSA', 60, 'REGISTRADA', 'Despacho demo', 'EXP-2605-003'),
  ('exp-demo-004', 'EXP-2026-000004', (select id from public.stock_pt where legacy_uid = 'pt-demo-007'), 'form-recria-balance', 'Recria Balance', 'PT-2604-03', (select id from public.clientes where legacy_uid = 'cli-002'), 'GRANEL', 35, 'REGISTRADA', 'Despacho demo', 'EXP-2605-004'),
  ('exp-demo-005', 'EXP-2026-000005', (select id from public.stock_pt where legacy_uid = 'pt-demo-008'), 'form-nucleo-inicio', 'Nucleo Inicio', 'PT-2604-04', (select id from public.clientes where legacy_uid = 'cli-001'), 'BIG_BAG', 55, 'REGISTRADA', 'Despacho demo', 'EXP-2605-005')
on conflict (legacy_uid) do update
set numero_expedicion = excluded.numero_expedicion,
    stock_pt_id = excluded.stock_pt_id,
    producto_id = excluded.producto_id,
    nombre_producto = excluded.nombre_producto,
    lote_pt = excluded.lote_pt,
    cliente_id = excluded.cliente_id,
    presentacion = excluded.presentacion,
    cantidad = excluded.cantidad,
    estado = excluded.estado,
    motivo = excluded.motivo,
    referencia = excluded.referencia,
    updated_at = now();

insert into public.stock_movimientos (
  lote_id, usuario_id, tipo, origen, cantidad, observaciones, metadata
)
values
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 250, 'Consumo OP demo 005 - Maiz molido', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), 'orden_legacy_uid', 'op-demo-005', 'lote_mp_legacy_uid', 'lot-maiz-2026-03', 'nombre_insumo', 'Maiz molido')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 150, 'Consumo OP demo 005 - Harina de soja', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), 'orden_legacy_uid', 'op-demo-005', 'lote_mp_legacy_uid', 'lot-soja-2026-01', 'nombre_insumo', 'Harina de soja')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-afrecho-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 120, 'Consumo OP demo 005 - Afrecho de trigo', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), 'orden_legacy_uid', 'op-demo-005', 'lote_mp_legacy_uid', 'lot-afrecho-2026-01', 'nombre_insumo', 'Afrecho de trigo')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-carbonato-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 30, 'Consumo OP demo 005 - Carbonato', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), 'orden_legacy_uid', 'op-demo-005', 'lote_mp_legacy_uid', 'lot-carbonato-2026-01', 'nombre_insumo', 'Carbonato de calcio')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-02'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 50, 'Consumo OP demo 005 - Premix', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), 'orden_legacy_uid', 'op-demo-005', 'lote_mp_legacy_uid', 'lot-premix-2026-02', 'nombre_insumo', 'Nucleo vitaminico')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 230, 'Consumo OP demo 006 - Maiz molido', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), 'orden_legacy_uid', 'op-demo-006', 'lote_mp_legacy_uid', 'lot-maiz-2026-03', 'nombre_insumo', 'Maiz molido')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-03'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 180, 'Consumo OP demo 006 - Harina de soja', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), 'orden_legacy_uid', 'op-demo-006', 'lote_mp_legacy_uid', 'lot-soja-2026-03', 'nombre_insumo', 'Harina de soja')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-girasol-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 90, 'Consumo OP demo 006 - Harina de girasol', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), 'orden_legacy_uid', 'op-demo-006', 'lote_mp_legacy_uid', 'lot-girasol-2026-01', 'nombre_insumo', 'Harina de girasol')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-melaza-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 60, 'Consumo OP demo 006 - Melaza', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), 'orden_legacy_uid', 'op-demo-006', 'lote_mp_legacy_uid', 'lot-melaza-2026-01', 'nombre_insumo', 'Melaza')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-aceite-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 90, 'Consumo OP demo 006 - Aceite', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), 'orden_legacy_uid', 'op-demo-006', 'lote_mp_legacy_uid', 'lot-aceite-2026-01', 'nombre_insumo', 'Aceite vegetal')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 160, 'Consumo OP demo 007 - Maiz molido', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), 'orden_legacy_uid', 'op-demo-007', 'lote_mp_legacy_uid', 'lot-maiz-2026-01', 'nombre_insumo', 'Maiz molido')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-02'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 150, 'Consumo OP demo 007 - Harina de soja', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), 'orden_legacy_uid', 'op-demo-007', 'lote_mp_legacy_uid', 'lot-soja-2026-02', 'nombre_insumo', 'Harina de soja')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-afrecho-2026-02'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 70, 'Consumo OP demo 007 - Afrecho de trigo', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), 'orden_legacy_uid', 'op-demo-007', 'lote_mp_legacy_uid', 'lot-afrecho-2026-02', 'nombre_insumo', 'Afrecho de trigo')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-fosfato-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 50, 'Consumo OP demo 007 - Fosfato', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), 'orden_legacy_uid', 'op-demo-007', 'lote_mp_legacy_uid', 'lot-fosfato-2026-01', 'nombre_insumo', 'Fosfato dicálcico')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-sal-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 20, 'Consumo OP demo 007 - Sal mineralizada', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), 'orden_legacy_uid', 'op-demo-007', 'lote_mp_legacy_uid', 'lot-sal-2026-01', 'nombre_insumo', 'Sal mineralizada')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-02'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 50, 'Consumo OP demo 007 - Premix', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), 'orden_legacy_uid', 'op-demo-007', 'lote_mp_legacy_uid', 'lot-premix-2026-02', 'nombre_insumo', 'Nucleo vitaminico')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 200, 'Consumo OP demo 008 - Maiz molido', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), 'orden_legacy_uid', 'op-demo-008', 'lote_mp_legacy_uid', 'lot-maiz-2026-01', 'nombre_insumo', 'Maiz molido')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 120, 'Consumo OP demo 008 - Harina de soja', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), 'orden_legacy_uid', 'op-demo-008', 'lote_mp_legacy_uid', 'lot-soja-2026-01', 'nombre_insumo', 'Harina de soja')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-girasol-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 70, 'Consumo OP demo 008 - Harina de girasol', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), 'orden_legacy_uid', 'op-demo-008', 'lote_mp_legacy_uid', 'lot-girasol-2026-01', 'nombre_insumo', 'Harina de girasol')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-aceite-2026-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 60, 'Consumo OP demo 008 - Aceite', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), 'orden_legacy_uid', 'op-demo-008', 'lote_mp_legacy_uid', 'lot-aceite-2026-01', 'nombre_insumo', 'Aceite vegetal')),
  ((select id from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-02'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), 'SALIDA', 'PRODUCCION', 100, 'Consumo OP demo 008 - Premix', jsonb_build_object('orden_id', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), 'orden_legacy_uid', 'op-demo-008', 'lote_mp_legacy_uid', 'lot-premix-2026-02', 'nombre_insumo', 'Nucleo vitaminico'));

-- Trazabilidad operativa
insert into public.trazabilidad_eventos (
  legacy_uid, orden_id, stock_lote_mp_id, stock_pt_id, tipo, referencia, payload, usuario_id, fecha_evento
)
values
  ('trz-op005-ingmp', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), null, 'INGRESO_MP', 'Ingreso MP OP 005', jsonb_build_object('lote', 'lot-maiz-2026-03', 'insumo', 'Maiz molido'), (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), now() - interval '4 days'),
  ('trz-op005-res', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), null, null, 'RESERVA_MP', 'Reserva MP OP 005', jsonb_build_object('detalle', 'Reserva previa de producción'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '4 days' + interval '2 hours'),
  ('trz-op005-cons', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), null, null, 'CONSUMO_MP', 'Consumo MP OP 005', jsonb_build_object('consumos', 5), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '4 days' + interval '6 hours'),
  ('trz-op005-fin', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), (select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'PRODUCCION_FIN', 'Finalizacion OP 005', jsonb_build_object('cantidad_real', 600, 'merma_manual', 12), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '4 days' + interval '8 hours'),
  ('trz-op005-ingpt', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'INGRESO_PT', 'Ingreso PT OP 005', jsonb_build_object('lote', 'PT-2604-01'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '4 days' + interval '8 hours' + interval '5 minutes'),
  ('trz-op005-desp', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'DESPACHO_PT', 'Despacho PT demo 005', jsonb_build_object('cantidad', 25), (select id from public.usuarios where legacy_uid = 'usr-finanzas-demo'), now() - interval '3 days'),

  ('trz-op006-ingmp', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), null, 'INGRESO_MP', 'Ingreso MP OP 006', jsonb_build_object('lote', 'lot-maiz-2026-03', 'insumo', 'Maiz molido'), (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), now() - interval '3 days'),
  ('trz-op006-res', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), null, null, 'RESERVA_MP', 'Reserva MP OP 006', jsonb_build_object('detalle', 'Reserva previa de producción'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '3 days' + interval '2 hours'),
  ('trz-op006-cons', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), null, null, 'CONSUMO_MP', 'Consumo MP OP 006', jsonb_build_object('consumos', 5), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '3 days' + interval '6 hours'),
  ('trz-op006-fin', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), (select id from public.stock_pt where legacy_uid = 'pt-demo-006'), 'PRODUCCION_FIN', 'Finalizacion OP 006', jsonb_build_object('cantidad_real', 650, 'merma_manual', 10), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '3 days' + interval '8 hours'),
  ('trz-op006-ingpt', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-006'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-006'), 'INGRESO_PT', 'Ingreso PT OP 006', jsonb_build_object('lote', 'PT-2604-02'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '3 days' + interval '8 hours' + interval '5 minutes'),

  ('trz-op007-ingmp', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-01'), null, 'INGRESO_MP', 'Ingreso MP OP 007', jsonb_build_object('lote', 'lot-maiz-2026-01', 'insumo', 'Maiz molido'), (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), now() - interval '2 days'),
  ('trz-op007-res', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), null, null, 'RESERVA_MP', 'Reserva MP OP 007', jsonb_build_object('detalle', 'Reserva previa de producción'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '2 days' + interval '2 hours'),
  ('trz-op007-cons', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), null, null, 'CONSUMO_MP', 'Consumo MP OP 007', jsonb_build_object('consumos', 6), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '2 days' + interval '6 hours'),
  ('trz-op007-fin', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-01'), (select id from public.stock_pt where legacy_uid = 'pt-demo-007'), 'PRODUCCION_FIN', 'Finalizacion OP 007', jsonb_build_object('cantidad_real', 500, 'merma_manual', 8), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '2 days' + interval '8 hours'),
  ('trz-op007-ingpt', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-007'), 'INGRESO_PT', 'Ingreso PT OP 007', jsonb_build_object('lote', 'PT-2604-03'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '2 days' + interval '8 hours' + interval '5 minutes'),

  ('trz-op008-ingmp', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-01'), null, 'INGRESO_MP', 'Ingreso MP OP 008', jsonb_build_object('lote', 'lot-soja-2026-01', 'insumo', 'Harina de soja'), (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), now() - interval '1 day'),
  ('trz-op008-res', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), null, null, 'RESERVA_MP', 'Reserva MP OP 008', jsonb_build_object('detalle', 'Reserva previa de producción'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '1 day' + interval '2 hours'),
  ('trz-op008-cons', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), null, null, 'CONSUMO_MP', 'Consumo MP OP 008', jsonb_build_object('consumos', 5), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '1 day' + interval '6 hours'),
  ('trz-op008-fin', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-01'), (select id from public.stock_pt where legacy_uid = 'pt-demo-008'), 'PRODUCCION_FIN', 'Finalizacion OP 008', jsonb_build_object('cantidad_real', 550, 'merma_manual', 15), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '1 day' + interval '8 hours'),
  ('trz-op008-ingpt', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-008'), 'INGRESO_PT', 'Ingreso PT OP 008', jsonb_build_object('lote', 'PT-2604-04'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '1 day' + interval '8 hours' + interval '5 minutes'),
  ('trz-op008-desp', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-008'), 'DESPACHO_PT', 'Despacho PT demo 008', jsonb_build_object('cantidad', 60), (select id from public.usuarios where legacy_uid = 'usr-finanzas-demo'), now() - interval '6 hours'),

  ('trz-op001-res', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-001'), null, null, 'RESERVA_MP', 'Reserva MP OP 001', jsonb_build_object('detalle', 'Pendiente de liberacion de stock'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '9 days'),
  ('trz-op002-res', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-002'), null, null, 'RESERVA_MP', 'Reserva MP OP 002', jsonb_build_object('detalle', 'Pendiente de liberacion de stock'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '8 days'),
  ('trz-op003-init', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-003'), null, null, 'PRODUCCION_INICIO', 'Inicio OP 003', jsonb_build_object('estado', 'EN PROCESO'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '6 days'),
  ('trz-op004-init', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-004'), null, null, 'PRODUCCION_INICIO', 'Inicio OP 004', jsonb_build_object('estado', 'EN PROCESO'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '5 days'),
  ('trz-op009-res', (select id from public.ordenes_produccion where legacy_uid = 'op-demo-009'), null, null, 'RESERVA_MP', 'Reserva MP OP 009', jsonb_build_object('detalle', 'Pendiente de prioridad de compra'), (select id from public.usuarios where legacy_uid = 'usr-produccion-demo'), now() - interval '1 day' + interval '3 hours');

-- Alertas persistidas
insert into public.alertas_estado (alerta_key, estado, comentario, usuario_id, origen, prioridad, ultima_actualizacion)
values
  ('stock_bajo_minimo:' || (select id::text from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-02'), 'EN_SEGUIMIENTO', 'Se priorizo la reposicion del lote de maiz.', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'stock', 'critica', now() - interval '2 days'),
  ('stock_bajo_minimo:' || (select id::text from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-02'), 'PENDIENTE', 'Lote de soja con disponibilidad ajustada.', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'stock', 'baja', now() - interval '1 day'),
  ('stock_bajo_minimo:' || (select id::text from public.stock_lotes_mp where legacy_uid = 'lot-premix-2026-01'), 'EN_SEGUIMIENTO', 'Premix con cobertura reducida.', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'stock', 'critica', now() - interval '3 days'),
  ('stock_bajo_minimo:' || (select id::text from public.stock_lotes_mp where legacy_uid = 'lot-afrecho-2026-02'), 'PENDIENTE', 'Afrecho en rango de alerta.', (select id from public.usuarios where legacy_uid = 'usr-admin-demo'), 'stock', 'baja', now() - interval '12 hours')
on conflict (alerta_key) do update
set estado = excluded.estado,
    comentario = excluded.comentario,
    usuario_id = excluded.usuario_id,
    origen = excluded.origen,
    prioridad = excluded.prioridad,
    ultima_actualizacion = excluded.ultima_actualizacion,
    updated_at = now();

-- Comprobantes, caja y presupuesto
insert into public.comprobantes (
  legacy_uid, tipo, numero, fecha_emision, fecha_vencimiento, tercero, estado, total, saldo
)
values
  ('comp-001', 'FACTURA_COMPRA', 'FC-001-2604', current_date - 12, current_date + 18, 'AgroNecta S.A.', 'PENDIENTE', 83250, 83250),
  ('comp-002', 'FACTURA_COMPRA', 'FC-002-2604', current_date - 10, current_date + 20, 'Granos del Sudeste SRL', 'PENDIENTE', 132000, 132000),
  ('comp-003', 'FACTURA_COMPRA', 'FC-003-2604', current_date - 8, current_date + 22, 'Nutrimix Insumos', 'PAGADO', 244400, 0),
  ('comp-004', 'FACTURA_VENTA', 'FV-004-2604', current_date - 5, current_date + 10, 'Lácteos del Sur', 'PENDIENTE', 186000, 62000),
  ('comp-005', 'FACTURA_VENTA', 'FV-005-2604', current_date - 2, current_date + 12, 'Cabañas Unidas', 'VENCIDO', 94500, 94500)
on conflict (legacy_uid) do update
set tipo = excluded.tipo,
    numero = excluded.numero,
    fecha_emision = excluded.fecha_emision,
    fecha_vencimiento = excluded.fecha_vencimiento,
    tercero = excluded.tercero,
    estado = excluded.estado,
    total = excluded.total,
    saldo = excluded.saldo,
    updated_at = now();

insert into public.flujo_caja_movimientos (
  legacy_uid, fecha, tipo, origen_operativo, descripcion, monto,
  categoria_id, centro_costo_id, cuenta_bancaria_id, forma_pago_id, comprobante_id,
  orden_produccion_id, stock_lote_mp_id, stock_pt_id, estado, metadata
)
values
  ('fcm-001', now() - interval '20 days', 'EGRESO', 'COMPRA', 'Pago parcial compra maiz molido', 40000, (select id from public.categorias_financieras where legacy_uid = 'cat-compras'), (select id from public.centros_costo where legacy_uid = 'cc-planta'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-main'), (select id from public.formas_pago where legacy_uid = 'fp-transferencia'), (select id from public.comprobantes where legacy_uid = 'comp-001'), null, (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-01'), null, 'CONFIRMADO', jsonb_build_object('origen', 'compra demo')),
  ('fcm-002', now() - interval '18 days', 'EGRESO', 'COMPRA', 'Pago parcial compra soja', 62000, (select id from public.categorias_financieras where legacy_uid = 'cat-compras'), (select id from public.centros_costo where legacy_uid = 'cc-planta'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-main'), (select id from public.formas_pago where legacy_uid = 'fp-transferencia'), (select id from public.comprobantes where legacy_uid = 'comp-002'), null, (select id from public.stock_lotes_mp where legacy_uid = 'lot-soja-2026-01'), null, 'CONFIRMADO', jsonb_build_object('origen', 'compra demo')),
  ('fcm-003', now() - interval '12 days', 'EGRESO', 'PRODUCCION', 'Consumo de insumos lote OP 005', 47000, (select id from public.categorias_financieras where legacy_uid = 'cat-compras'), (select id from public.centros_costo where legacy_uid = 'cc-planta'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-main'), (select id from public.formas_pago where legacy_uid = 'fp-transferencia'), null, (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), (select id from public.stock_lotes_mp where legacy_uid = 'lot-maiz-2026-03'), null, 'CONFIRMADO', jsonb_build_object('origen', 'produccion demo')),
  ('fcm-004', now() - interval '6 days', 'INGRESO', 'PRODUCCION', 'Ingreso de producto terminado OP 005', 140000, (select id from public.categorias_financieras where legacy_uid = 'cat-ventas'), (select id from public.centros_costo where legacy_uid = 'cc-planta'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-cobros'), (select id from public.formas_pago where legacy_uid = 'fp-transferencia'), null, (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'CONFIRMADO', jsonb_build_object('origen', 'venta demo')),
  ('fcm-005', now() - interval '5 days', 'INGRESO', 'VENTA', 'Cobro venta PT', 62000, (select id from public.categorias_financieras where legacy_uid = 'cat-cobranzas'), (select id from public.centros_costo where legacy_uid = 'cc-administracion'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-cobros'), (select id from public.formas_pago where legacy_uid = 'fp-transferencia'), (select id from public.comprobantes where legacy_uid = 'comp-004'), null, null, (select id from public.stock_pt where legacy_uid = 'pt-demo-006'), 'CONFIRMADO', jsonb_build_object('origen', 'cobranza demo')),
  ('fcm-006', now() - interval '4 days', 'EGRESO', 'LOGISTICA', 'Flete despacho PT demo', 18000, (select id from public.categorias_financieras where legacy_uid = 'cat-logistica'), (select id from public.centros_costo where legacy_uid = 'cc-logistica'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-main'), (select id from public.formas_pago where legacy_uid = 'fp-efectivo'), null, (select id from public.ordenes_produccion where legacy_uid = 'op-demo-005'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-005'), 'CONFIRMADO', jsonb_build_object('origen', 'logistica demo')),
  ('fcm-007', now() - interval '3 days', 'INGRESO', 'VENTA', 'Cobro por venta de PT', 94500, (select id from public.categorias_financieras where legacy_uid = 'cat-cobranzas'), (select id from public.centros_costo where legacy_uid = 'cc-administracion'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-reserva'), (select id from public.formas_pago where legacy_uid = 'fp-cheque-30'), (select id from public.comprobantes where legacy_uid = 'comp-005'), null, null, null, 'CONFIRMADO', jsonb_build_object('origen', 'venta demo')),
  ('fcm-009', now() - interval '2 days', 'INGRESO', 'VENTA', 'Cobro venta PT Recria Balance', 11900, (select id from public.categorias_financieras where legacy_uid = 'cat-cobranzas'), (select id from public.centros_costo where legacy_uid = 'cc-administracion'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-cobros'), (select id from public.formas_pago where legacy_uid = 'fp-transferencia'), null, (select id from public.ordenes_produccion where legacy_uid = 'op-demo-007'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-007'), 'CONFIRMADO', jsonb_build_object('origen', 'venta demo')),
  ('fcm-010', now() - interval '2 days' + interval '2 hours', 'INGRESO', 'VENTA', 'Cobro venta PT Nucleo Inicio', 22000, (select id from public.categorias_financieras where legacy_uid = 'cat-cobranzas'), (select id from public.centros_costo where legacy_uid = 'cc-administracion'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-cobros'), (select id from public.formas_pago where legacy_uid = 'fp-transferencia'), null, (select id from public.ordenes_produccion where legacy_uid = 'op-demo-008'), null, (select id from public.stock_pt where legacy_uid = 'pt-demo-008'), 'CONFIRMADO', jsonb_build_object('origen', 'venta demo')),
  ('fcm-008', now() - interval '1 day', 'TRANSFERENCIA', 'TESORERIA', 'Transferencia entre cuentas demo', 50000, (select id from public.categorias_financieras where legacy_uid = 'cat-transferencias'), (select id from public.centros_costo where legacy_uid = 'cc-administracion'), (select id from public.cuentas_bancarias where legacy_uid = 'cb-main'), (select id from public.formas_pago where legacy_uid = 'fp-transferencia'), null, null, null, null, 'CONFIRMADO', jsonb_build_object('origen', 'tesoreria demo'));

insert into public.presupuestos_mensuales (
  legacy_uid, anio, mes, categoria_id, centro_costo_id, monto_presupuestado
)
values
  ('pres-2026-04-ventas', extract(year from current_date)::int, extract(month from current_date)::int, (select id from public.categorias_financieras where legacy_uid = 'cat-ventas'), (select id from public.centros_costo where legacy_uid = 'cc-planta'), 420000),
  ('pres-2026-04-compras', extract(year from current_date)::int, extract(month from current_date)::int, (select id from public.categorias_financieras where legacy_uid = 'cat-compras'), (select id from public.centros_costo where legacy_uid = 'cc-planta'), 610000),
  ('pres-2026-04-logistica', extract(year from current_date)::int, extract(month from current_date)::int, (select id from public.categorias_financieras where legacy_uid = 'cat-logistica'), (select id from public.centros_costo where legacy_uid = 'cc-logistica'), 85000)
on conflict (legacy_uid) do update
set anio = excluded.anio,
    mes = excluded.mes,
    categoria_id = excluded.categoria_id,
    centro_costo_id = excluded.centro_costo_id,
    monto_presupuestado = excluded.monto_presupuestado,
    updated_at = now();

commit;
