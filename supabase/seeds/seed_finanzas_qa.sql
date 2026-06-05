-- Seed QA Fase 5.5: Finanzas operativo end-to-end
-- Recomendado correr luego de seed_phase1_qa.sql

-- 1) Plan de cuentas base
insert into public.plan_cuentas (codigo, nombre, tipo, naturaleza)
values
  ('1.1.1', 'Caja y Bancos', 'ACTIVO', 'DEUDORA'),
  ('1.1.2', 'Cuentas por Cobrar', 'ACTIVO', 'DEUDORA'),
  ('2.1.1', 'Cuentas por Pagar', 'PASIVO', 'ACREEDORA'),
  ('4.1.1', 'Ventas', 'INGRESO', 'ACREEDORA'),
  ('5.1.1', 'Compras Materia Prima', 'EGRESO', 'DEUDORA'),
  ('5.1.2', 'Gastos Operativos', 'EGRESO', 'DEUDORA'),
  ('5.1.3', 'Impuestos y Servicios', 'EGRESO', 'DEUDORA'),
  ('5.1.4', 'Pérdidas por Merma', 'RESULTADO', 'DEUDORA')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  tipo = excluded.tipo,
  naturaleza = excluded.naturaleza;

-- 2) Categorías financieras
insert into public.categorias_financieras (legacy_uid, nombre, tipo_movimiento, area, plan_cuenta_id)
select
  x.legacy_uid,
  x.nombre,
  x.tipo_movimiento,
  x.area,
  pc.id
from (
  values
    ('cat-fin-001','Compra MP','EGRESO','stock','5.1.1'),
    ('cat-fin-002','Pago Proveedor','EGRESO','stock','2.1.1'),
    ('cat-fin-003','Venta Producto','INGRESO','productos','4.1.1'),
    ('cat-fin-004','Gasto Operativo','EGRESO','produccion','5.1.2'),
    ('cat-fin-005','Impuestos','EGRESO','costos','5.1.3'),
    ('cat-fin-006','Servicios','EGRESO','costos','5.1.3'),
    ('cat-fin-007','Transferencia Interna','TRANSFERENCIA','costos','1.1.1'),
    ('cat-fin-008','Costo Producción','EGRESO','produccion','5.1.2'),
    ('cat-fin-009','Pérdida por Merma','EGRESO','produccion','5.1.4')
) x(legacy_uid, nombre, tipo_movimiento, area, codigo_plan)
join public.plan_cuentas pc on pc.codigo = x.codigo_plan
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  tipo_movimiento = excluded.tipo_movimiento,
  area = excluded.area,
  plan_cuenta_id = excluded.plan_cuenta_id;

-- 3) Centros de costo
insert into public.centros_costo (legacy_uid, nombre, descripcion)
values
  ('cc-fin-001', 'Producción Planta', 'Costos de operación directa de planta'),
  ('cc-fin-002', 'Logística', 'Despacho, fletes y movimientos internos'),
  ('cc-fin-003', 'Administración', 'Estructura administrativa y servicios')
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion;

-- 4) Cuentas bancarias
insert into public.cuentas_bancarias (legacy_uid, banco, alias, cbu, moneda, saldo_actual)
values
  ('cb-fin-001', 'Banco Nación', 'NUTRIBALANCE.OP', '2850590940090418135201', 'ARS', 4800000),
  ('cb-fin-002', 'Banco Galicia', 'NUTRIBALANCE.COBROS', '0070999890000001234501', 'ARS', 2100000)
on conflict (legacy_uid) do update set
  banco = excluded.banco,
  alias = excluded.alias,
  cbu = excluded.cbu,
  moneda = excluded.moneda,
  saldo_actual = excluded.saldo_actual;

-- 5) Formas de pago
insert into public.formas_pago (legacy_uid, nombre, tipo, dias_plazo)
values
  ('fp-fin-001', 'Transferencia inmediata', 'TRANSFERENCIA', 0),
  ('fp-fin-002', 'Cuenta corriente 30 días', 'CTA_CTE', 30),
  ('fp-fin-003', 'Cheque 15 días', 'CHEQUE', 15),
  ('fp-fin-004', 'Efectivo', 'EFECTIVO', 0)
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  tipo = excluded.tipo,
  dias_plazo = excluded.dias_plazo;

-- 6) Comprobantes (CxP y CxC)
insert into public.comprobantes (legacy_uid, tipo, numero, fecha_emision, fecha_vencimiento, tercero, estado, total, saldo)
values
  ('comp-fin-001', 'FACTURA_COMPRA', 'FC-A 0001-00001234', current_date - 12, current_date + 18, 'AgroGranos Pampeanos S.A.', 'PENDIENTE', 920000, 350000),
  ('comp-fin-002', 'FACTURA_COMPRA', 'FC-A 0002-00004567', current_date - 20, current_date - 2, 'NutriSoja del Litoral SRL', 'VENCIDO', 780000, 410000),
  ('comp-fin-003', 'FACTURA_VENTA', 'FV-A 0003-00000121', current_date - 6, current_date + 24, 'Estancia La Esperanza', 'PENDIENTE', 1250000, 1250000),
  ('comp-fin-004', 'FACTURA_VENTA', 'FV-A 0003-00000122', current_date - 10, current_date + 20, 'Feedlot Los Alamos', 'PENDIENTE', 980000, 420000)
on conflict (legacy_uid) do update set
  tipo = excluded.tipo,
  numero = excluded.numero,
  fecha_emision = excluded.fecha_emision,
  fecha_vencimiento = excluded.fecha_vencimiento,
  tercero = excluded.tercero,
  estado = excluded.estado,
  total = excluded.total,
  saldo = excluded.saldo;

-- 7) Presupuestos mensuales
insert into public.presupuestos_mensuales (legacy_uid, anio, mes, categoria_id, centro_costo_id, monto_presupuestado)
select
  x.legacy_uid,
  extract(year from current_date)::int,
  extract(month from current_date)::int,
  cf.id,
  cc.id,
  x.monto
from (
  values
    ('pres-fin-001', 'cat-fin-001', 'cc-fin-001', 1800000::numeric),
    ('pres-fin-002', 'cat-fin-004', 'cc-fin-001', 650000::numeric),
    ('pres-fin-003', 'cat-fin-005', 'cc-fin-003', 420000::numeric),
    ('pres-fin-004', 'cat-fin-006', 'cc-fin-003', 380000::numeric)
) x(legacy_uid, cat_uid, cc_uid, monto)
join public.categorias_financieras cf on cf.legacy_uid = x.cat_uid
join public.centros_costo cc on cc.legacy_uid = x.cc_uid
on conflict (legacy_uid) do update set
  anio = excluded.anio,
  mes = excluded.mes,
  categoria_id = excluded.categoria_id,
  centro_costo_id = excluded.centro_costo_id,
  monto_presupuestado = excluded.monto_presupuestado;

-- 8) Movimientos financieros QA (operación -> finanzas)
delete from public.flujo_caja_movimientos
where legacy_uid like 'mov-fin-%';

with refs as (
  select
    (select id from public.cuentas_bancarias where legacy_uid = 'cb-fin-001' limit 1) as cb1,
    (select id from public.cuentas_bancarias where legacy_uid = 'cb-fin-002' limit 1) as cb2,
    (select id from public.formas_pago where legacy_uid = 'fp-fin-001' limit 1) as fp_tr,
    (select id from public.formas_pago where legacy_uid = 'fp-fin-002' limit 1) as fp_cc,
    (select id from public.categorias_financieras where legacy_uid = 'cat-fin-001' limit 1) as cat_compra_mp,
    (select id from public.categorias_financieras where legacy_uid = 'cat-fin-002' limit 1) as cat_pago_prov,
    (select id from public.categorias_financieras where legacy_uid = 'cat-fin-003' limit 1) as cat_venta,
    (select id from public.categorias_financieras where legacy_uid = 'cat-fin-004' limit 1) as cat_gasto,
    (select id from public.categorias_financieras where legacy_uid = 'cat-fin-005' limit 1) as cat_impuesto,
    (select id from public.categorias_financieras where legacy_uid = 'cat-fin-006' limit 1) as cat_servicio,
    (select id from public.categorias_financieras where legacy_uid = 'cat-fin-008' limit 1) as cat_costo_prod,
    (select id from public.categorias_financieras where legacy_uid = 'cat-fin-009' limit 1) as cat_merma,
    (select id from public.centros_costo where legacy_uid = 'cc-fin-001' limit 1) as cc_prod,
    (select id from public.centros_costo where legacy_uid = 'cc-fin-003' limit 1) as cc_admin,
    (select id from public.comprobantes where legacy_uid = 'comp-fin-001' limit 1) as comp1,
    (select id from public.comprobantes where legacy_uid = 'comp-fin-002' limit 1) as comp2,
    (select id from public.comprobantes where legacy_uid = 'comp-fin-003' limit 1) as comp3,
    (select id from public.comprobantes where legacy_uid = 'comp-fin-004' limit 1) as comp4,
    (select id from public.ordenes_produccion where legacy_uid = 'OP-2026-103' limit 1) as op_fin,
    (select id from public.stock_lotes_mp where legacy_uid = 'stk-001' limit 1) as lote_maiz,
    (select id from public.stock_lotes_mp where legacy_uid = 'stk-002' limit 1) as lote_soja,
    (select id from public.stock_pt where id_orden_legacy = 'OP-2026-103' limit 1) as pt_103
)
insert into public.flujo_caja_movimientos (
  legacy_uid, fecha, tipo, origen_operativo, descripcion, monto,
  categoria_id, centro_costo_id, cuenta_bancaria_id, forma_pago_id,
  comprobante_id, orden_produccion_id, stock_lote_mp_id, stock_pt_id,
  estado, metadata
)
select * from (
  select
    'mov-fin-001'::text,
    now() - interval '24 days',
    'EGRESO'::text,
    'COMPRA_MP'::text,
    'Compra MP lote MAIZ stk-001'::text,
    920000::numeric,
    refs.cat_compra_mp,
    refs.cc_prod,
    refs.cb1,
    refs.fp_cc,
    refs.comp1,
    null::uuid,
    refs.lote_maiz,
    null::uuid,
    'CONFIRMADO'::text,
    jsonb_build_object('proveedor', 'AgroGranos Pampeanos S.A.')
  from refs
  union all
  select
    'mov-fin-002',
    now() - interval '19 days',
    'EGRESO','COMPRA_MP','Compra MP lote SOJA stk-002',780000,
    refs.cat_compra_mp, refs.cc_prod, refs.cb1, refs.fp_cc,
    refs.comp2, null::uuid, refs.lote_soja, null::uuid,
    'CONFIRMADO', jsonb_build_object('proveedor', 'NutriSoja del Litoral SRL')
  from refs
  union all
  select
    'mov-fin-003',
    now() - interval '12 days',
    'EGRESO','PAGO_PROVEEDOR','Pago parcial proveedor AgroGranos',570000,
    refs.cat_pago_prov, refs.cc_admin, refs.cb1, refs.fp_tr,
    refs.comp1, null::uuid, refs.lote_maiz, null::uuid,
    'CONFIRMADO', jsonb_build_object('concepto', 'cancelacion parcial')
  from refs
  union all
  select
    'mov-fin-004',
    now() - interval '10 days',
    'EGRESO','PAGO_PROVEEDOR','Pago parcial proveedor NutriSoja',370000,
    refs.cat_pago_prov, refs.cc_admin, refs.cb1, refs.fp_tr,
    refs.comp2, null::uuid, refs.lote_soja, null::uuid,
    'CONFIRMADO', jsonb_build_object('concepto', 'cancelacion parcial')
  from refs
  union all
  select
    'mov-fin-005',
    now() - interval '8 days',
    'INGRESO','VENTA','Cobro venta FV-A 0003-00000121',1250000,
    refs.cat_venta, refs.cc_admin, refs.cb2, refs.fp_tr,
    refs.comp3, refs.op_fin, null::uuid, refs.pt_103,
    'CONFIRMADO', jsonb_build_object('cliente', 'Estancia La Esperanza')
  from refs
  union all
  select
    'mov-fin-006',
    now() - interval '7 days',
    'INGRESO','VENTA','Cobro parcial venta FV-A 0003-00000122',560000,
    refs.cat_venta, refs.cc_admin, refs.cb2, refs.fp_tr,
    refs.comp4, refs.op_fin, null::uuid, refs.pt_103,
    'CONFIRMADO', jsonb_build_object('cliente', 'Feedlot Los Alamos')
  from refs
  union all
  select
    'mov-fin-007',
    now() - interval '6 days',
    'EGRESO','PRODUCCION','Costo operativo producción OP-2026-103',245000,
    refs.cat_costo_prod, refs.cc_prod, refs.cb1, refs.fp_tr,
    null::uuid, refs.op_fin, null::uuid, refs.pt_103,
    'CONFIRMADO', jsonb_build_object('orden', 'OP-2026-103')
  from refs
  union all
  select
    'mov-fin-008',
    now() - interval '5 days',
    'EGRESO','MERMA','Pérdida por merma OP-2026-103',18000,
    refs.cat_merma, refs.cc_prod, refs.cb1, refs.fp_tr,
    null::uuid, refs.op_fin, null::uuid, refs.pt_103,
    'CONFIRMADO', jsonb_build_object('merma_kg', 35)
  from refs
  union all
  select
    'mov-fin-009',
    now() - interval '4 days',
    'EGRESO','IMPUESTO','Pago impuesto provincial ingresos brutos',132000,
    refs.cat_impuesto, refs.cc_admin, refs.cb1, refs.fp_tr,
    null::uuid, null::uuid, null::uuid, null::uuid,
    'CONFIRMADO', jsonb_build_object('periodo', to_char(current_date, 'YYYY-MM'))
  from refs
  union all
  select
    'mov-fin-010',
    now() - interval '3 days',
    'EGRESO','SERVICIO','Pago energía eléctrica planta',98000,
    refs.cat_servicio, refs.cc_admin, refs.cb1, refs.fp_tr,
    null::uuid, null::uuid, null::uuid, null::uuid,
    'CONFIRMADO', jsonb_build_object('proveedor', 'Empresa de Energia')
  from refs
) as q(
  legacy_uid, fecha, tipo, origen_operativo, descripcion, monto,
  categoria_id, centro_costo_id, cuenta_bancaria_id, forma_pago_id,
  comprobante_id, orden_produccion_id, stock_lote_mp_id, stock_pt_id,
  estado, metadata
);
