-- Seed Demo Integral Fase 8.3
-- Idempotente: usa ON CONFLICT y limpieza controlada por prefijo demo-

-- =========================
-- A) CATALOGOS BASE
-- =========================
insert into public.roles (code, nombre, descripcion)
values
  ('ADMIN', 'Administrador', 'Acceso administrativo total'),
  ('OPERADOR', 'Operador', 'Gestión operativa'),
  ('FINANZAS', 'Finanzas', 'Gestión financiera y reportes'),
  ('QA', 'QA', 'Validación funcional y demo')
on conflict (code) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion;

with r as (
  select code, id from public.roles where code in ('ADMIN', 'OPERADOR', 'FINANZAS', 'QA')
)
insert into public.usuarios (legacy_uid, role_id, nombre, email, esta_activo)
select * from (
  select 'demo-usr-admin'::text, (select id from r where code = 'ADMIN'), 'Admin Demo'::text, 'admin.demo@nutribalance.local'::text, true
  union all
  select 'demo-usr-op-1', (select id from r where code = 'OPERADOR'), 'Operador Planta', 'operador.demo@nutribalance.local', true
  union all
  select 'demo-usr-op-2', (select id from r where code = 'OPERADOR'), 'Operador Turno Noche', 'operador2.demo@nutribalance.local', true
  union all
  select 'demo-usr-fin', (select id from r where code = 'FINANZAS'), 'Analista Finanzas', 'finanzas.demo@nutribalance.local', true
  union all
  select 'demo-usr-qa', (select id from r where code = 'QA'), 'QA Demo', 'qa.demo@nutribalance.local', true
) t(legacy_uid, role_id, nombre, email, esta_activo)
on conflict (legacy_uid) do update set
  role_id = excluded.role_id,
  nombre = excluded.nombre,
  email = excluded.email,
  esta_activo = excluded.esta_activo;

insert into public.proveedores (legacy_uid, nombre_empresa, contacto_nombre, telefono, email, direccion, documento, esta_activo)
values
  ('demo-prov-01', 'Agro Maizal SA', 'Carlos Pinto', '+54 11 4000 1001', 'ventas@agromaizal.local', 'Ruta 3 km 88', '30-80000001-1', true),
  ('demo-prov-02', 'Soja Premium SRL', 'Laura Díaz', '+54 11 4000 1002', 'contacto@sojapremium.local', 'Parque Industrial Norte', '30-80000002-2', true),
  ('demo-prov-03', 'NutriMinerales SA', 'Néstor Ríos', '+54 11 4000 1003', 'pedidos@nutriminerales.local', 'Av. Central 225', '30-80000003-3', true),
  ('demo-prov-04', 'Fibras del Sur', 'Pamela Suárez', '+54 11 4000 1004', 'comercial@fibrasdelsur.local', 'Ruta 8 km 144', '30-80000004-4', true)
on conflict (legacy_uid) do update set
  nombre_empresa = excluded.nombre_empresa,
  contacto_nombre = excluded.contacto_nombre,
  telefono = excluded.telefono,
  email = excluded.email,
  direccion = excluded.direccion,
  documento = excluded.documento,
  esta_activo = excluded.esta_activo;

insert into public.insumos (
  legacy_uid, nombre, unidad_medida, categoria, umbral_alerta, ref_costo_unitario,
  proteina_bruta_pct, humedad_pct, fibra_pct, grasa_pct, cenizas_pct, unidad_base, observaciones, esta_activo
)
values
  ('demo-ins-01', 'Maiz', 'KG', 'Grano', 1500, 0.30, 8.50, 12.0, 2.2, 3.8, 1.4, 'KG', 'Demo integral', true),
  ('demo-ins-02', 'Harina de Soja 47%', 'KG', 'Proteico', 1200, 0.44, 47.0, 11.0, 5.3, 1.9, 6.2, 'KG', 'Demo integral', true),
  ('demo-ins-03', 'Afrechillo de Trigo', 'KG', 'Fibra', 900, 0.25, 16.0, 11.5, 10.0, 3.1, 5.8, 'KG', 'Demo integral', true),
  ('demo-ins-04', 'Nucleo Vitaminico', 'KG', 'Suplemento', 200, 2.10, 2.0, 4.0, 1.0, 0.5, 90.0, 'KG', 'Demo integral', true),
  ('demo-ins-05', 'Sal Comun', 'KG', 'Aditivo', 250, 0.19, 0.0, 0.2, 0.0, 0.0, 99.8, 'KG', 'Demo integral', true),
  ('demo-ins-06', 'Melaza', 'KG', 'Energetico', 350, 0.33, 3.2, 20.0, 0.5, 0.2, 8.0, 'KG', 'Demo integral', true),
  ('demo-ins-07', 'Carbonato de Calcio', 'KG', 'Mineral', 180, 0.22, 0.0, 0.1, 0.0, 0.0, 98.5, 'KG', 'Demo integral', true),
  ('demo-ins-08', 'Fosfato Bicalcico', 'KG', 'Mineral', 160, 0.82, 0.0, 0.1, 0.0, 0.0, 97.0, 'KG', 'Demo integral', true)
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
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
  esta_activo = excluded.esta_activo;

insert into public.silos (legacy_uid, nombre, descripcion, esta_activo)
values
  ('demo-silo-01', 'Silo MP Maiz', 'Stock maiz', true),
  ('demo-silo-02', 'Silo MP Soja', 'Stock soja', true),
  ('demo-silo-03', 'Silo MP Fibra', 'Stock afrechillo', true),
  ('demo-silo-04', 'Silo PT Recria', 'Producto terminado recria', true),
  ('demo-silo-05', 'Silo PT Engorde', 'Producto terminado engorde', true),
  ('demo-silo-06', 'Silo PT Lechera', 'Producto terminado lechera', true)
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  esta_activo = excluded.esta_activo;

insert into public.plan_cuentas (codigo, nombre, tipo, naturaleza)
values
  ('1.1.1', 'Caja y Bancos', 'ACTIVO', 'DEUDORA'),
  ('2.1.1', 'Cuentas por Pagar', 'PASIVO', 'ACREEDORA'),
  ('4.1.1', 'Ventas', 'INGRESO', 'ACREEDORA'),
  ('5.1.1', 'Compras MP', 'EGRESO', 'DEUDORA'),
  ('5.1.2', 'Gastos Operativos', 'EGRESO', 'DEUDORA'),
  ('5.1.3', 'Impuestos y Servicios', 'EGRESO', 'DEUDORA'),
  ('5.1.4', 'Mermas', 'RESULTADO', 'DEUDORA')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  tipo = excluded.tipo,
  naturaleza = excluded.naturaleza;

insert into public.categorias_financieras (legacy_uid, nombre, tipo_movimiento, area, plan_cuenta_id)
select x.legacy_uid, x.nombre, x.tipo_mov, x.area, pc.id
from (values
  ('demo-cat-01','Compra MP','EGRESO','stock','5.1.1'),
  ('demo-cat-02','Pago Proveedor','EGRESO','stock','2.1.1'),
  ('demo-cat-03','Venta PT','INGRESO','productos','4.1.1'),
  ('demo-cat-04','Gasto Operativo','EGRESO','produccion','5.1.2'),
  ('demo-cat-05','Servicios','EGRESO','costos','5.1.3'),
  ('demo-cat-06','Impuestos','EGRESO','costos','5.1.3'),
  ('demo-cat-07','Costo Produccion','EGRESO','produccion','5.1.2'),
  ('demo-cat-08','Perdida Merma','EGRESO','produccion','5.1.4')
) x(legacy_uid, nombre, tipo_mov, area, codigo)
join public.plan_cuentas pc on pc.codigo = x.codigo
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  tipo_movimiento = excluded.tipo_movimiento,
  area = excluded.area,
  plan_cuenta_id = excluded.plan_cuenta_id;

insert into public.centros_costo (legacy_uid, nombre, descripcion)
values
  ('demo-cc-01', 'Produccion', 'Centro de costo operativo'),
  ('demo-cc-02', 'Logistica', 'Centro logistico'),
  ('demo-cc-03', 'Administracion', 'Centro administrativo')
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion;

insert into public.cuentas_bancarias (legacy_uid, banco, alias, cbu, moneda, saldo_actual)
values
  ('demo-cb-01', 'Banco Nacion', 'DEMO.OPERACION', '2850590940090418131111', 'ARS', 7500000),
  ('demo-cb-02', 'Banco Galicia', 'DEMO.COBROS', '0070999890000001231111', 'ARS', 3900000)
on conflict (legacy_uid) do update set
  banco = excluded.banco,
  alias = excluded.alias,
  cbu = excluded.cbu,
  moneda = excluded.moneda,
  saldo_actual = excluded.saldo_actual;

insert into public.formas_pago (legacy_uid, nombre, tipo, dias_plazo)
values
  ('demo-fp-01', 'Transferencia inmediata', 'TRANSFERENCIA', 0),
  ('demo-fp-02', 'Cuenta corriente 30 dias', 'CTA_CTE', 30),
  ('demo-fp-03', 'Efectivo', 'EFECTIVO', 0)
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  tipo = excluded.tipo,
  dias_plazo = excluded.dias_plazo;

-- =========================
-- B) INVENTARIO MP
-- =========================
with u as (select id from public.usuarios where legacy_uid = 'demo-usr-admin' limit 1)
insert into public.stock_lotes_mp (
  legacy_uid, insumo_id, proveedor_id, lote, remito_nro, ubicacion,
  cantidad_inicial, cantidad_actual, cantidad_comprometida,
  costo_unitario, costo_total, fecha_ingreso, id_usuario
)
select
  x.legacy_uid,
  i.id,
  p.id,
  x.lote,
  x.remito,
  x.ubicacion,
  x.cantidad_inicial,
  x.cantidad_actual,
  x.comprometida,
  x.costo_unitario,
  x.cantidad_inicial * x.costo_unitario,
  x.fecha_ingreso,
  u.id
from (values
  ('demo-lmp-01','demo-ins-01','demo-prov-01','MZ-2605-A','REM-001','Silo MP Maiz',14000::numeric,7800::numeric,1500::numeric,0.30::numeric, now()-interval '21 day'),
  ('demo-lmp-02','demo-ins-01','demo-prov-01','MZ-2605-B','REM-002','Silo MP Maiz',9000,4200,500,0.32, now()-interval '14 day'),
  ('demo-lmp-03','demo-ins-02','demo-prov-02','SJ-2605-A','REM-003','Silo MP Soja',12000,6900,1200,0.44, now()-interval '20 day'),
  ('demo-lmp-04','demo-ins-02','demo-prov-02','SJ-2605-B','REM-004','Silo MP Soja',7000,2800,300,0.46, now()-interval '12 day'),
  ('demo-lmp-05','demo-ins-03','demo-prov-04','AF-2605-A','REM-005','Silo MP Fibra',9000,3100,250,0.25, now()-interval '18 day'),
  ('demo-lmp-06','demo-ins-04','demo-prov-03','NV-2605-A','REM-006','Micro',2000,240,40,2.10, now()-interval '16 day'),
  ('demo-lmp-07','demo-ins-05','demo-prov-03','SAL-2605-A','REM-007','Aditivos',3000,760,0,0.19, now()-interval '15 day'),
  ('demo-lmp-08','demo-ins-06','demo-prov-01','MLZ-2605-A','REM-008','Liquidos',2500,980,60,0.33, now()-interval '13 day'),
  ('demo-lmp-09','demo-ins-07','demo-prov-03','CCA-2605-A','REM-009','Minerales',2200,150,20,0.22, now()-interval '11 day'),
  ('demo-lmp-10','demo-ins-08','demo-prov-03','FBC-2605-A','REM-010','Minerales',1800,120,20,0.82, now()-interval '10 day')
) x(legacy_uid, ins_legacy, prov_legacy, lote, remito, ubicacion, cantidad_inicial, cantidad_actual, comprometida, costo_unitario, fecha_ingreso)
join public.insumos i on i.legacy_uid = x.ins_legacy
join public.proveedores p on p.legacy_uid = x.prov_legacy
cross join u
on conflict (legacy_uid) do update set
  insumo_id = excluded.insumo_id,
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
  id_usuario = excluded.id_usuario;

-- =========================
-- C) FORMULAS
-- =========================
with u as (select id from public.usuarios where legacy_uid = 'demo-usr-op-1' limit 1)
insert into public.formulas (
  legacy_uid, nombre_producto, version, esta_activa, ultima_edicion, id_usuario, author, created_at,
  proteina_calculada_pct, costo_total, costo_por_kg, costo_por_tonelada, advertencias_nutricionales, advertencias_costos
)
select * from (
  select 'demo-for-01','Recria',1,true,now(),u.id,'Operador Planta',now()-interval '18 day',16.2::numeric,352.10::numeric,0.3521::numeric,352.10::numeric,'[]'::jsonb,'[]'::jsonb from u
  union all select 'demo-for-02','Crianza',1,true,now(),u.id,'Operador Planta',now()-interval '18 day',18.1,368.50,0.3685,368.50,'[]'::jsonb,'[]'::jsonb from u
  union all select 'demo-for-03','Preparto',1,true,now(),u.id,'Operador Planta',now()-interval '17 day',14.9,340.20,0.3402,340.20,'[]'::jsonb,'[]'::jsonb from u
  union all select 'demo-for-04','Engorde',2,true,now(),u.id,'Operador Planta',now()-interval '17 day',17.4,360.80,0.3608,360.80,'[]'::jsonb,'[]'::jsonb from u
  union all select 'demo-for-05','Lechera 13%',1,true,now(),u.id,'Operador Planta',now()-interval '16 day',13.0,334.00,0.3340,334.00,'[]'::jsonb,'[]'::jsonb from u
  union all select 'demo-for-06','Lechera 18%',1,true,now(),u.id,'Operador Planta',now()-interval '16 day',18.0,382.00,0.3820,382.00,'[]'::jsonb,'[]'::jsonb from u
) t(legacy_uid, nombre_producto, version, esta_activa, ultima_edicion, id_usuario, author, created_at, proteina_calculada_pct, costo_total, costo_por_kg, costo_por_tonelada, advertencias_nutricionales, advertencias_costos)
on conflict (legacy_uid) do update set
  nombre_producto = excluded.nombre_producto,
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
  advertencias_costos = excluded.advertencias_costos;

delete from public.formula_ingredientes
where formula_id in (select id from public.formulas where legacy_uid like 'demo-for-%');

insert into public.formula_ingredientes (
  formula_id, insumo_id, nombre_insumo, porcentaje, orden,
  aporte_proteina_pct, aporte_proteina_g_kg, costo_unitario_usado, costo_contribucion_kg, fuente_costo
)
select
  f.id, i.id, x.nombre, x.pct, x.orden,
  round((x.pct / 100.0) * coalesce(i.proteina_bruta_pct,0),4),
  round(((x.pct / 100.0) * coalesce(i.proteina_bruta_pct,0)) * 10,4),
  x.costo,
  round((x.pct / 100.0) * x.costo,4),
  'ULTIMO_LOTE'
from (values
  -- Recria
  ('demo-for-01','demo-ins-01','Maiz',45::numeric,1,0.30::numeric),
  ('demo-for-01','demo-ins-02','Harina de Soja 47%',25,2,0.44),
  ('demo-for-01','demo-ins-03','Afrechillo de Trigo',18,3,0.25),
  ('demo-for-01','demo-ins-04','Nucleo Vitaminico',5,4,2.10),
  ('demo-for-01','demo-ins-05','Sal Comun',2,5,0.19),
  ('demo-for-01','demo-ins-06','Melaza',3,6,0.33),
  ('demo-for-01','demo-ins-07','Carbonato de Calcio',1,7,0.22),
  ('demo-for-01','demo-ins-08','Fosfato Bicalcico',1,8,0.82),
  -- Crianza
  ('demo-for-02','demo-ins-01','Maiz',42,1,0.30),('demo-for-02','demo-ins-02','Harina de Soja 47%',31,2,0.44),('demo-for-02','demo-ins-03','Afrechillo de Trigo',15,3,0.25),('demo-for-02','demo-ins-04','Nucleo Vitaminico',5,4,2.10),('demo-for-02','demo-ins-05','Sal Comun',2,5,0.19),('demo-for-02','demo-ins-06','Melaza',3,6,0.33),('demo-for-02','demo-ins-07','Carbonato de Calcio',1,7,0.22),('demo-for-02','demo-ins-08','Fosfato Bicalcico',1,8,0.82),
  -- Preparto
  ('demo-for-03','demo-ins-01','Maiz',50,1,0.30),('demo-for-03','demo-ins-02','Harina de Soja 47%',20,2,0.44),('demo-for-03','demo-ins-03','Afrechillo de Trigo',20,3,0.25),('demo-for-03','demo-ins-04','Nucleo Vitaminico',4,4,2.10),('demo-for-03','demo-ins-05','Sal Comun',2,5,0.19),('demo-for-03','demo-ins-06','Melaza',2,6,0.33),('demo-for-03','demo-ins-07','Carbonato de Calcio',1,7,0.22),('demo-for-03','demo-ins-08','Fosfato Bicalcico',1,8,0.82),
  -- Engorde
  ('demo-for-04','demo-ins-01','Maiz',46,1,0.30),('demo-for-04','demo-ins-02','Harina de Soja 47%',28,2,0.44),('demo-for-04','demo-ins-03','Afrechillo de Trigo',15,3,0.25),('demo-for-04','demo-ins-04','Nucleo Vitaminico',5,4,2.10),('demo-for-04','demo-ins-05','Sal Comun',2,5,0.19),('demo-for-04','demo-ins-06','Melaza',2,6,0.33),('demo-for-04','demo-ins-07','Carbonato de Calcio',1,7,0.22),('demo-for-04','demo-ins-08','Fosfato Bicalcico',1,8,0.82),
  -- Lechera 13
  ('demo-for-05','demo-ins-01','Maiz',54,1,0.30),('demo-for-05','demo-ins-02','Harina de Soja 47%',18,2,0.44),('demo-for-05','demo-ins-03','Afrechillo de Trigo',18,3,0.25),('demo-for-05','demo-ins-04','Nucleo Vitaminico',4,4,2.10),('demo-for-05','demo-ins-05','Sal Comun',2,5,0.19),('demo-for-05','demo-ins-06','Melaza',2,6,0.33),('demo-for-05','demo-ins-07','Carbonato de Calcio',1,7,0.22),('demo-for-05','demo-ins-08','Fosfato Bicalcico',1,8,0.82),
  -- Lechera 18
  ('demo-for-06','demo-ins-01','Maiz',39,1,0.30),('demo-for-06','demo-ins-02','Harina de Soja 47%',35,2,0.44),('demo-for-06','demo-ins-03','Afrechillo de Trigo',14,3,0.25),('demo-for-06','demo-ins-04','Nucleo Vitaminico',6,4,2.10),('demo-for-06','demo-ins-05','Sal Comun',2,5,0.19),('demo-for-06','demo-ins-06','Melaza',2,6,0.33),('demo-for-06','demo-ins-07','Carbonato de Calcio',1,7,0.22),('demo-for-06','demo-ins-08','Fosfato Bicalcico',1,8,0.82)
) x(for_legacy, ins_legacy, nombre, pct, orden, costo)
join public.formulas f on f.legacy_uid = x.for_legacy
join public.insumos i on i.legacy_uid = x.ins_legacy;

-- =========================
-- D) ORDENES + CONSUMO
-- =========================
with opusr as (
  select
    (select id from public.usuarios where legacy_uid='demo-usr-op-1') as op1,
    (select id from public.usuarios where legacy_uid='demo-usr-op-2') as op2
)
insert into public.ordenes_produccion (
  legacy_uid, lote, formula_id, id_formula_legacy, nombre_producto, version_formula,
  cantidad_objetivo, cantidad_real, merma_manual,
  silo_id, id_silo_legacy, destino_silo,
  estado, fecha_creacion, usuario_responsable, usuario_id, costo_total_insumos
)
select * from (
  select 'demo-op-001','OP-DEMO-001',(select id from public.formulas where legacy_uid='demo-for-01'),'demo-for-01','Recria',1,2500::numeric,null::numeric,null::numeric,null::uuid,null::text,null::text,'PENDIENTE',now()-interval '3 day','Operador Planta',(select op1 from opusr),880::numeric
  union all select 'demo-op-002','OP-DEMO-002',(select id from public.formulas where legacy_uid='demo-for-02'),'demo-for-02','Crianza',1,3200,null,null,null,null,null,'EN PROCESO',now()-interval '2 day','Operador Turno Noche',(select op2 from opusr),1179
  union all select 'demo-op-003','OP-DEMO-003',(select id from public.formulas where legacy_uid='demo-for-04'),'demo-for-04','Engorde',2,3000,2920,80,(select id from public.silos where legacy_uid='demo-silo-05'),'demo-silo-05','Silo PT Engorde','FINALIZADO',now()-interval '8 day','Operador Planta',(select op1 from opusr),1082
  union all select 'demo-op-004','OP-DEMO-004',(select id from public.formulas where legacy_uid='demo-for-06'),'demo-for-06','Lechera 18%',1,2800,2710,90,(select id from public.silos where legacy_uid='demo-silo-06'),'demo-silo-06','Silo PT Lechera','FINALIZADO',now()-interval '6 day','Operador Turno Noche',(select op2 from opusr),1067
  union all select 'demo-op-005','OP-DEMO-005',(select id from public.formulas where legacy_uid='demo-for-05'),'demo-for-05','Lechera 13%',1,2600,null,null,null,null,null,'ANULADO',now()-interval '5 day','Operador Planta',(select op1 from opusr),0
  union all select 'demo-op-006','OP-DEMO-006',(select id from public.formulas where legacy_uid='demo-for-03'),'demo-for-03','Preparto',1,1800,1770,30,(select id from public.silos where legacy_uid='demo-silo-04'),'demo-silo-04','Silo PT Recria','FINALIZADO',now()-interval '4 day','Operador Planta',(select op1 from opusr),624
) t(
  legacy_uid, lote, formula_id, id_formula_legacy, nombre_producto, version_formula,
  cantidad_objetivo, cantidad_real, merma_manual,
  silo_id, id_silo_legacy, destino_silo,
  estado, fecha_creacion, usuario_responsable, usuario_id, costo_total_insumos
)
on conflict (legacy_uid) do update set
  lote = excluded.lote,
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
  costo_total_insumos = excluded.costo_total_insumos;

delete from public.orden_consumo_lotes
where orden_id in (select id from public.ordenes_produccion where legacy_uid like 'demo-op-%');

insert into public.orden_consumo_lotes (
  orden_id, lote_id, id_lote_legacy, insumo_id, id_insumo_legacy, nombre_insumo,
  cantidad_usada, tipo_unidad, costo_unitario, costo_total
)
select
  o.id, l.id, x.lote_legacy, i.id, x.ins_legacy, i.nombre,
  x.cantidad, 'KG', l.costo_unitario, round(x.cantidad * l.costo_unitario, 6)
from (values
  ('demo-op-001','demo-lmp-01','demo-ins-01',1125::numeric),('demo-op-001','demo-lmp-03','demo-ins-02',625),('demo-op-001','demo-lmp-05','demo-ins-03',450),('demo-op-001','demo-lmp-06','demo-ins-04',125),('demo-op-001','demo-lmp-07','demo-ins-05',50),
  ('demo-op-002','demo-lmp-02','demo-ins-01',1344),('demo-op-002','demo-lmp-03','demo-ins-02',992),('demo-op-002','demo-lmp-05','demo-ins-03',480),('demo-op-002','demo-lmp-06','demo-ins-04',160),('demo-op-002','demo-lmp-07','demo-ins-05',64),
  ('demo-op-003','demo-lmp-01','demo-ins-01',1380),('demo-op-003','demo-lmp-04','demo-ins-02',840),('demo-op-003','demo-lmp-05','demo-ins-03',450),('demo-op-003','demo-lmp-06','demo-ins-04',150),('demo-op-003','demo-lmp-07','demo-ins-05',60),
  ('demo-op-004','demo-lmp-02','demo-ins-01',1092),('demo-op-004','demo-lmp-04','demo-ins-02',980),('demo-op-004','demo-lmp-05','demo-ins-03',392),('demo-op-004','demo-lmp-06','demo-ins-04',168),('demo-op-004','demo-lmp-07','demo-ins-05',56),
  ('demo-op-006','demo-lmp-01','demo-ins-01',900),('demo-op-006','demo-lmp-03','demo-ins-02',360),('demo-op-006','demo-lmp-05','demo-ins-03',360),('demo-op-006','demo-lmp-06','demo-ins-04',72),('demo-op-006','demo-lmp-07','demo-ins-05',36)
) x(op_legacy, lote_legacy, ins_legacy, cantidad)
join public.ordenes_produccion o on o.legacy_uid = x.op_legacy
join public.stock_lotes_mp l on l.legacy_uid = x.lote_legacy
join public.insumos i on i.legacy_uid = x.ins_legacy;

-- =========================
-- E) STOCK PT
-- =========================
insert into public.stock_pt (
  legacy_uid, orden_id, id_orden_legacy, numero_orden, nombre_producto, cantidad_total, lote, unidad_medida, estado,
  silo_id, id_silo_legacy, nombre_silo, detalle_insumos, fecha_ingreso, usuario
)
select
  x.legacy_uid,
  o.id,
  x.op_legacy,
  x.op_legacy,
  o.nombre_producto,
  x.cantidad,
  x.lote,
  'KG',
  x.estado,
  s.id,
  x.silo_legacy,
  s.nombre,
  '[]'::jsonb,
  x.fecha,
  x.usuario
from (values
  ('demo-pt-001','demo-op-003',2920::numeric,'PT-DEMO-003','OK','demo-silo-05',now()-interval '8 day','Operador Planta'),
  ('demo-pt-002','demo-op-004',2710::numeric,'PT-DEMO-004','OK','demo-silo-06',now()-interval '6 day','Operador Turno Noche'),
  ('demo-pt-003','demo-op-006',1770::numeric,'PT-DEMO-006','BAJO','demo-silo-04',now()-interval '4 day','Operador Planta')
) x(legacy_uid, op_legacy, cantidad, lote, estado, silo_legacy, fecha, usuario)
join public.ordenes_produccion o on o.legacy_uid = x.op_legacy
join public.silos s on s.legacy_uid = x.silo_legacy
on conflict (legacy_uid) do update set
  orden_id = excluded.orden_id,
  id_orden_legacy = excluded.id_orden_legacy,
  numero_orden = excluded.numero_orden,
  nombre_producto = excluded.nombre_producto,
  cantidad_total = excluded.cantidad_total,
  lote = excluded.lote,
  unidad_medida = excluded.unidad_medida,
  estado = excluded.estado,
  silo_id = excluded.silo_id,
  id_silo_legacy = excluded.id_silo_legacy,
  nombre_silo = excluded.nombre_silo,
  detalle_insumos = excluded.detalle_insumos,
  fecha_ingreso = excluded.fecha_ingreso,
  usuario = excluded.usuario;

-- =========================
-- F) TRAZABILIDAD
-- =========================
insert into public.trazabilidad_eventos (
  legacy_uid, orden_id, stock_lote_mp_id, stock_pt_id, tipo, referencia, payload, fecha_evento, usuario_id
)
select
  x.legacy_uid,
  o.id,
  l.id,
  pt.id,
  x.tipo,
  x.referencia,
  x.payload,
  x.fecha,
  u.id
from (values
  ('demo-trz-001','demo-op-003','demo-lmp-01',null,'PRODUCCION_INICIO','Inicio OP 003','{}'::jsonb,now()-interval '8 day'),
  ('demo-trz-002','demo-op-003','demo-lmp-01',null,'CONSUMO_MP','Consumo maiz OP 003','{"cantidad":1380}'::jsonb,now()-interval '8 day' + interval '20 min'),
  ('demo-trz-003','demo-op-003',null,null,'PRODUCCION_FIN','Fin OP 003','{"cantidad_real":2920,"merma":80}'::jsonb,now()-interval '8 day' + interval '4 hour'),
  ('demo-trz-004','demo-op-003',null,'demo-pt-001','INGRESO_PT','Ingreso PT OP 003','{"lote_pt":"PT-DEMO-003"}'::jsonb,now()-interval '8 day' + interval '4 hour 10 min'),

  ('demo-trz-005','demo-op-004','demo-lmp-02',null,'PRODUCCION_INICIO','Inicio OP 004','{}'::jsonb,now()-interval '6 day'),
  ('demo-trz-006','demo-op-004','demo-lmp-04',null,'CONSUMO_MP','Consumo soja OP 004','{"cantidad":980}'::jsonb,now()-interval '6 day' + interval '30 min'),
  ('demo-trz-007','demo-op-004',null,null,'PRODUCCION_FIN','Fin OP 004','{"cantidad_real":2710,"merma":90}'::jsonb,now()-interval '6 day' + interval '5 hour'),
  ('demo-trz-008','demo-op-004',null,'demo-pt-002','INGRESO_PT','Ingreso PT OP 004','{"lote_pt":"PT-DEMO-004"}'::jsonb,now()-interval '6 day' + interval '5 hour 10 min'),

  ('demo-trz-009','demo-op-002','demo-lmp-02',null,'RESERVA_MP','Reserva OP 002','{"cantidad":1200}'::jsonb,now()-interval '2 day' + interval '10 min'),
  ('demo-trz-010','demo-op-006',null,'demo-pt-003','INGRESO_PT','Ingreso PT OP 006','{"lote_pt":"PT-DEMO-006"}'::jsonb,now()-interval '4 day' + interval '3 hour')
) x(legacy_uid, op_legacy, lote_legacy, pt_legacy, tipo, referencia, payload, fecha)
left join public.ordenes_produccion o on o.legacy_uid = x.op_legacy
left join public.stock_lotes_mp l on l.legacy_uid = x.lote_legacy
left join public.stock_pt pt on pt.legacy_uid = x.pt_legacy
left join public.usuarios u on u.legacy_uid = 'demo-usr-op-1'
on conflict (legacy_uid) do update set
  orden_id = excluded.orden_id,
  stock_lote_mp_id = excluded.stock_lote_mp_id,
  stock_pt_id = excluded.stock_pt_id,
  tipo = excluded.tipo,
  referencia = excluded.referencia,
  payload = excluded.payload,
  fecha_evento = excluded.fecha_evento,
  usuario_id = excluded.usuario_id;

-- =========================
-- G) FINANZAS
-- =========================
insert into public.comprobantes (legacy_uid, tipo, numero, fecha_emision, fecha_vencimiento, tercero, estado, total, saldo)
values
  ('demo-comp-001','FACTURA_COMPRA','FC-A 0001-900001',current_date-18,current_date+12,'Agro Maizal SA','PENDIENTE',1450000,540000),
  ('demo-comp-002','FACTURA_COMPRA','FC-A 0001-900002',current_date-17,current_date+8,'Soja Premium SRL','PENDIENTE',1730000,730000),
  ('demo-comp-003','FACTURA_VENTA','FV-A 0003-800001',current_date-7,current_date+21,'Establecimiento San Jorge','PENDIENTE',2250000,1020000),
  ('demo-comp-004','FACTURA_VENTA','FV-A 0003-800002',current_date-5,current_date+25,'Tambos del Valle','PENDIENTE',1810000,1810000)
on conflict (legacy_uid) do update set
  tipo = excluded.tipo,
  numero = excluded.numero,
  fecha_emision = excluded.fecha_emision,
  fecha_vencimiento = excluded.fecha_vencimiento,
  tercero = excluded.tercero,
  estado = excluded.estado,
  total = excluded.total,
  saldo = excluded.saldo;

insert into public.presupuestos_mensuales (legacy_uid, anio, mes, categoria_id, centro_costo_id, monto_presupuestado)
select
  x.legacy_uid,
  extract(year from current_date)::int,
  extract(month from current_date)::int,
  c.id,
  cc.id,
  x.monto
from (values
  ('demo-pres-01','demo-cat-01','demo-cc-01',2800000::numeric),
  ('demo-pres-02','demo-cat-04','demo-cc-01',920000::numeric),
  ('demo-pres-03','demo-cat-05','demo-cc-03',450000::numeric),
  ('demo-pres-04','demo-cat-06','demo-cc-03',360000::numeric)
) x(legacy_uid, cat_legacy, cc_legacy, monto)
join public.categorias_financieras c on c.legacy_uid = x.cat_legacy
join public.centros_costo cc on cc.legacy_uid = x.cc_legacy
on conflict (legacy_uid) do update set
  anio = excluded.anio,
  mes = excluded.mes,
  categoria_id = excluded.categoria_id,
  centro_costo_id = excluded.centro_costo_id,
  monto_presupuestado = excluded.monto_presupuestado;

delete from public.flujo_caja_movimientos where legacy_uid like 'demo-mov-%';

with r as (
  select
    (select id from public.cuentas_bancarias where legacy_uid='demo-cb-01') as cb1,
    (select id from public.cuentas_bancarias where legacy_uid='demo-cb-02') as cb2,
    (select id from public.formas_pago where legacy_uid='demo-fp-01') as fp_tr,
    (select id from public.formas_pago where legacy_uid='demo-fp-02') as fp_cc,
    (select id from public.categorias_financieras where legacy_uid='demo-cat-01') as cat_compra,
    (select id from public.categorias_financieras where legacy_uid='demo-cat-02') as cat_pago,
    (select id from public.categorias_financieras where legacy_uid='demo-cat-03') as cat_venta,
    (select id from public.categorias_financieras where legacy_uid='demo-cat-04') as cat_gasto,
    (select id from public.categorias_financieras where legacy_uid='demo-cat-05') as cat_serv,
    (select id from public.categorias_financieras where legacy_uid='demo-cat-06') as cat_imp,
    (select id from public.categorias_financieras where legacy_uid='demo-cat-07') as cat_costo_prod,
    (select id from public.categorias_financieras where legacy_uid='demo-cat-08') as cat_merma,
    (select id from public.centros_costo where legacy_uid='demo-cc-01') as cc_prod,
    (select id from public.centros_costo where legacy_uid='demo-cc-03') as cc_admin,
    (select id from public.comprobantes where legacy_uid='demo-comp-001') as comp1,
    (select id from public.comprobantes where legacy_uid='demo-comp-002') as comp2,
    (select id from public.comprobantes where legacy_uid='demo-comp-003') as comp3,
    (select id from public.comprobantes where legacy_uid='demo-comp-004') as comp4,
    (select id from public.ordenes_produccion where legacy_uid='demo-op-003') as op3,
    (select id from public.ordenes_produccion where legacy_uid='demo-op-004') as op4,
    (select id from public.stock_lotes_mp where legacy_uid='demo-lmp-01') as lmp1,
    (select id from public.stock_lotes_mp where legacy_uid='demo-lmp-03') as lmp3,
    (select id from public.stock_pt where legacy_uid='demo-pt-001') as pt1,
    (select id from public.stock_pt where legacy_uid='demo-pt-002') as pt2
)
insert into public.flujo_caja_movimientos (
  legacy_uid, fecha, tipo, origen_operativo, descripcion, monto,
  categoria_id, centro_costo_id, cuenta_bancaria_id, forma_pago_id,
  comprobante_id, orden_produccion_id, stock_lote_mp_id, stock_pt_id,
  estado, metadata
)
select * from (
  select 'demo-mov-001', now()-interval '18 day', 'EGRESO', 'COMPRA_MP', 'Compra maiz lote demo-lmp-01', 1450000::numeric, r.cat_compra, r.cc_prod, r.cb1, r.fp_cc, r.comp1, null::uuid, r.lmp1, null::uuid, 'CONFIRMADO', jsonb_build_object('proveedor','Agro Maizal SA') from r
  union all select 'demo-mov-002', now()-interval '17 day', 'EGRESO', 'COMPRA_MP', 'Compra soja lote demo-lmp-03', 1730000, r.cat_compra, r.cc_prod, r.cb1, r.fp_cc, r.comp2, null::uuid, r.lmp3, null::uuid, 'CONFIRMADO', jsonb_build_object('proveedor','Soja Premium SRL') from r
  union all select 'demo-mov-003', now()-interval '12 day', 'EGRESO', 'PAGO_PROVEEDOR', 'Pago parcial Agro Maizal', 910000, r.cat_pago, r.cc_admin, r.cb1, r.fp_tr, r.comp1, null::uuid, r.lmp1, null::uuid, 'CONFIRMADO', '{}'::jsonb from r
  union all select 'demo-mov-004', now()-interval '10 day', 'EGRESO', 'PAGO_PROVEEDOR', 'Pago parcial Soja Premium', 1000000, r.cat_pago, r.cc_admin, r.cb1, r.fp_tr, r.comp2, null::uuid, r.lmp3, null::uuid, 'CONFIRMADO', '{}'::jsonb from r
  union all select 'demo-mov-005', now()-interval '7 day', 'INGRESO', 'VENTA', 'Cobro venta OP 003', 2250000, r.cat_venta, r.cc_admin, r.cb2, r.fp_tr, r.comp3, r.op3, null::uuid, r.pt1, 'CONFIRMADO', '{}'::jsonb from r
  union all select 'demo-mov-006', now()-interval '5 day', 'INGRESO', 'VENTA', 'Cobro venta OP 004', 1810000, r.cat_venta, r.cc_admin, r.cb2, r.fp_tr, r.comp4, r.op4, null::uuid, r.pt2, 'CONFIRMADO', '{}'::jsonb from r
  union all select 'demo-mov-007', now()-interval '8 day', 'EGRESO', 'PRODUCCION', 'Costo produccion OP 003', 410000, r.cat_costo_prod, r.cc_prod, r.cb1, r.fp_tr, null::uuid, r.op3, null::uuid, r.pt1, 'CONFIRMADO', '{}'::jsonb from r
  union all select 'demo-mov-008', now()-interval '6 day', 'EGRESO', 'PRODUCCION', 'Costo produccion OP 004', 395000, r.cat_costo_prod, r.cc_prod, r.cb1, r.fp_tr, null::uuid, r.op4, null::uuid, r.pt2, 'CONFIRMADO', '{}'::jsonb from r
  union all select 'demo-mov-009', now()-interval '6 day', 'EGRESO', 'MERMA', 'Perdida por merma OP 003', 28000, r.cat_merma, r.cc_prod, r.cb1, r.fp_tr, null::uuid, r.op3, null::uuid, r.pt1, 'CONFIRMADO', jsonb_build_object('merma_kg',80) from r
  union all select 'demo-mov-010', now()-interval '4 day', 'EGRESO', 'SERVICIO', 'Servicio electrico planta', 135000, r.cat_serv, r.cc_admin, r.cb1, r.fp_tr, null::uuid, null::uuid, null::uuid, null::uuid, 'CONFIRMADO', '{}'::jsonb from r
  union all select 'demo-mov-011', now()-interval '3 day', 'EGRESO', 'IMPUESTO', 'Impuesto municipal', 92000, r.cat_imp, r.cc_admin, r.cb1, r.fp_tr, null::uuid, null::uuid, null::uuid, null::uuid, 'CONFIRMADO', '{}'::jsonb from r
  union all select 'demo-mov-012', now()-interval '2 day', 'EGRESO', 'GASTO_OPERATIVO', 'Mantenimiento de peletizadora', 118000, r.cat_gasto, r.cc_prod, r.cb1, r.fp_tr, null::uuid, null::uuid, null::uuid, null::uuid, 'CONFIRMADO', '{}'::jsonb from r
) q(
  legacy_uid, fecha, tipo, origen_operativo, descripcion, monto,
  categoria_id, centro_costo_id, cuenta_bancaria_id, forma_pago_id,
  comprobante_id, orden_produccion_id, stock_lote_mp_id, stock_pt_id,
  estado, metadata
);

-- =========================
-- H) AUDITORIA
-- =========================
insert into public.auditoria_acciones (legacy_uid, usuario_id, usuario_login, usuario_nombre, rol, modulo, accion, entidad, entidad_ref, payload)
select
  x.legacy_uid,
  u.id,
  u.email,
  u.nombre,
  'ADMIN',
  'produccion',
  x.accion,
  'ordenes_produccion',
  o.legacy_uid,
  jsonb_build_object('estado', o.estado, 'orden', o.legacy_uid, 'source', 'seed_demo_integral')
from (values
  ('demo-aud-001','demo-op-002','UPDATE'),
  ('demo-aud-002','demo-op-003','UPDATE'),
  ('demo-aud-003','demo-op-004','UPDATE')
) x(legacy_uid, op_legacy, accion)
join public.ordenes_produccion o on o.legacy_uid = x.op_legacy
join public.usuarios u on u.legacy_uid = 'demo-usr-admin'
on conflict (legacy_uid) do update set
  usuario_id = excluded.usuario_id,
  usuario_login = excluded.usuario_login,
  usuario_nombre = excluded.usuario_nombre,
  rol = excluded.rol,
  modulo = excluded.modulo,
  accion = excluded.accion,
  entidad = excluded.entidad,
  entidad_ref = excluded.entidad_ref,
  payload = excluded.payload;
