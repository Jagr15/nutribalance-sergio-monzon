-- Seed QA Fase 1: Core operativo en Supabase
-- Idempotente (ON CONFLICT) para poder re-ejecutar.

-- 1) Roles y usuarios base
insert into public.roles (code, nombre, descripcion)
values
  ('ADMIN', 'Administrador', 'Acceso administrativo total'),
  ('OPERADOR', 'Operador', 'Gestión operativa')
on conflict (code) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion;

with role_admin as (
  select id from public.roles where code = 'ADMIN' limit 1
), role_operador as (
  select id from public.roles where code = 'OPERADOR' limit 1
)
insert into public.usuarios (legacy_uid, role_id, nombre, email, esta_activo)
select * from (
  select 'usr-admin-01'::text, role_admin.id, 'Usuario Admin'::text, 'admin@nutribalance.local'::text, true from role_admin
  union all
  select 'usr-101'::text, role_admin.id, 'Sergio Monzón'::text, 'sergio@nutribalance.local'::text, true from role_admin
  union all
  select 'usr-102'::text, role_operador.id, 'Edwin'::text, 'edwin@nutribalance.local'::text, true from role_operador
) as t(legacy_uid, role_id, nombre, email, esta_activo)
on conflict (legacy_uid) do update set
  role_id = excluded.role_id,
  nombre = excluded.nombre,
  email = excluded.email,
  esta_activo = excluded.esta_activo;

-- 2) Catálogos base (proveedores, insumos, silos)
insert into public.proveedores (
  legacy_uid, nombre_empresa, contacto_nombre, telefono, email, direccion, documento, esta_activo
)
values
  ('p-1', 'AgroGranos Pampeanos S.A.', 'Mariano Fernández', '+54 9 11 4455 7788', 'ventas@agrogranos.com.ar', 'Ruta 8 Km 212, Pergamino, Buenos Aires', '30-71234567-9', true),
  ('p-2', 'NutriSoja del Litoral SRL', 'Luciana Rivas', '+54 9 341 522 3344', 'comercial@nutrisoja.com.ar', 'Av. Circunvalación 1450, Rosario, Santa Fe', '30-70999888-1', true),
  ('p-3', 'Premezclas Andinas', 'Gustavo Páez', '+54 9 261 611 2300', 'pedidos@premezclasandinas.com.ar', 'Parque Industrial 3, Godoy Cruz, Mendoza', '30-70111222-4', true)
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
  proteina_bruta_pct, humedad_pct, fibra_pct, grasa_pct, cenizas_pct, unidad_base, observaciones,
  esta_activo
)
values
  ('i-1', 'Maíz', 'KG', 'Grano', 1200, 0.29, 8.50, 12.00, 2.20, 3.90, 1.40, 'KG', 'Dato QA', true),
  ('i-2', 'Soja', 'KG', 'Grano', 900, 0.41, 44.00, 11.00, 6.00, 1.80, 6.20, 'KG', 'Dato QA', true),
  ('i-3', 'Núcleo Vitamínico', 'KG', 'Suplemento', 180, 1.95, 2.00, 4.00, 1.00, 0.50, 90.00, 'KG', 'Dato QA', true),
  ('i-4', 'Sal', 'KG', 'Aditivo', 200, 0.18, 0.00, 0.20, 0.00, 0.00, 99.80, 'KG', 'Dato QA', true),
  ('i-5', 'Afrechillo', 'KG', 'Suplemento', 800, 0.24, 16.00, 11.50, 10.00, 3.20, 5.80, 'KG', 'Dato QA', true)
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
  ('silo-001', 'Silo Maíz', 'Silo principal para grano de maíz de alta rotación.', true),
  ('silo-002', 'Silo Soja', 'Silo dedicado a harina y expeller de soja.', true),
  ('silo-003', 'Silo Lechera', 'Destino de producto terminado para línea lechera.', true),
  ('silo-004', 'Silo Cerdo', 'Destino de producto terminado para línea porcina.', true)
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  esta_activo = excluded.esta_activo;

-- 3) Stock MP (lotes)
with usr as (
  select id from public.usuarios where legacy_uid = 'usr-admin-01' limit 1
), lotes as (
  select * from (
    values
      ('stk-001','i-1','p-1','MZ-2505-A','REM-BA-005421','Silo Maíz',10000::numeric,3200::numeric,1200::numeric,0.29::numeric,2900::numeric,'2026-05-10T08:30:00Z'::timestamptz,'2026-05-10T08:35:00Z'::timestamptz,'2026-05-16T10:00:00Z'::timestamptz),
      ('stk-002','i-2','p-2','SJ-2505-C','REM-SF-001193','Silo Soja',5000::numeric,3400::numeric,300::numeric,0.41::numeric,2050::numeric,'2026-05-12T09:00:00Z'::timestamptz,'2026-05-12T09:15:00Z'::timestamptz,'2026-05-16T11:15:00Z'::timestamptz),
      ('stk-003','i-3','p-3','NV-2505-B','REM-MZ-000877','Depósito Micro',1000::numeric,35::numeric,20::numeric,1.95::numeric,1950::numeric,'2026-05-14T07:40:00Z'::timestamptz,'2026-05-14T07:45:00Z'::timestamptz,'2026-05-16T09:50:00Z'::timestamptz),
      ('stk-004','i-4','p-3','SAL-2505-A','REM-MZ-000861','Depósito Aditivos',1200::numeric,850::numeric,0::numeric,0.18::numeric,216::numeric,'2026-05-11T12:20:00Z'::timestamptz,'2026-05-11T12:25:00Z'::timestamptz,'2026-05-15T08:00:00Z'::timestamptz),
      ('stk-005','i-5','p-2','AF-2505-D','REM-SF-001241','Silo Soja',3000::numeric,980::numeric,0::numeric,0.24::numeric,720::numeric,'2026-05-13T16:30:00Z'::timestamptz,'2026-05-13T16:35:00Z'::timestamptz,'2026-05-15T10:00:00Z'::timestamptz)
  ) as t(legacy_uid, legacy_insumo_uid, legacy_proveedor_uid, lote, remito_nro, ubicacion, cantidad_inicial, cantidad_actual, cantidad_comprometida, costo_unitario, costo_total, fecha_ingreso, created_at, updated_at)
)
insert into public.stock_lotes_mp (
  legacy_uid, insumo_id, proveedor_id, lote, remito_nro, ubicacion,
  cantidad_inicial, cantidad_actual, cantidad_comprometida,
  costo_unitario, costo_total, fecha_ingreso, id_usuario, created_at, updated_at
)
select
  l.legacy_uid,
  i.id,
  p.id,
  l.lote,
  l.remito_nro,
  l.ubicacion,
  l.cantidad_inicial,
  l.cantidad_actual,
  l.cantidad_comprometida,
  l.costo_unitario,
  l.costo_total,
  l.fecha_ingreso,
  usr.id,
  l.created_at,
  l.updated_at
from lotes l
join public.insumos i on i.legacy_uid = l.legacy_insumo_uid
join public.proveedores p on p.legacy_uid = l.legacy_proveedor_uid
cross join usr
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
  id_usuario = excluded.id_usuario,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

-- 4) Formulas
with usr as (
  select id from public.usuarios where legacy_uid = 'usr-101' limit 1
)
insert into public.formulas (
  legacy_uid, nombre_producto, version, esta_activa, ultima_edicion, id_usuario, author, created_at,
  proteina_calculada_pct, costo_total, costo_por_kg, costo_por_tonelada, advertencias_nutricionales, advertencias_costos
)
select * from (
  select 'for-001'::text, 'Alimento Lechera'::text, 2::int, true, '2026-05-15T10:00:00Z'::timestamptz, usr.id, 'Sergio Monzón'::text, '2026-05-10T09:00:00Z'::timestamptz,
  19.78::numeric, 399.30::numeric, 0.3993::numeric, 399.30::numeric, '[]'::jsonb, '[]'::jsonb from usr
  union all
  select 'for-002'::text, 'Pellet Cerdo Crecimiento'::text, 1::int, true, '2026-05-16T15:30:00Z'::timestamptz, usr.id, 'Sergio Monzón'::text, '2026-05-12T13:30:00Z'::timestamptz,
  21.49::numeric, 386.00::numeric, 0.3860::numeric, 386.00::numeric, '[]'::jsonb, '[]'::jsonb from usr
) as t(legacy_uid, nombre_producto, version, esta_activa, ultima_edicion, id_usuario, author, created_at, proteina_calculada_pct, costo_total, costo_por_kg, costo_por_tonelada, advertencias_nutricionales, advertencias_costos)
on conflict (legacy_uid) do update set
  nombre_producto = excluded.nombre_producto,
  version = excluded.version,
  esta_activa = excluded.esta_activa,
  ultima_edicion = excluded.ultima_edicion,
  id_usuario = excluded.id_usuario,
  author = excluded.author,
  created_at = excluded.created_at,
  proteina_calculada_pct = excluded.proteina_calculada_pct,
  costo_total = excluded.costo_total,
  costo_por_kg = excluded.costo_por_kg,
  costo_por_tonelada = excluded.costo_por_tonelada,
  advertencias_nutricionales = excluded.advertencias_nutricionales,
  advertencias_costos = excluded.advertencias_costos;

-- 5) Formula ingredientes (reset controlado solo para fórmulas seeded)
delete from public.formula_ingredientes
where formula_id in (
  select id from public.formulas where legacy_uid in ('for-001', 'for-002')
);

insert into public.formula_ingredientes (
  formula_id, insumo_id, nombre_insumo, porcentaje, orden,
  aporte_proteina_pct, aporte_proteina_g_kg,
  costo_unitario_usado, costo_contribucion_kg, fuente_costo
)
select
  f.id, i.id, x.nombre_insumo, x.porcentaje, x.orden,
  x.aporte_proteina_pct, x.aporte_proteina_g_kg,
  x.costo_unitario_usado, x.costo_contribucion_kg, x.fuente_costo
from (
  values
    ('for-001','i-1','Maíz',48::numeric,1,4.0800::numeric,40.8000::numeric,0.29::numeric,0.1392::numeric,'ULTIMO_LOTE'::text),
    ('for-001','i-2','Soja',30::numeric,2,13.2000::numeric,132.0000::numeric,0.41::numeric,0.1230::numeric,'ULTIMO_LOTE'::text),
    ('for-001','i-5','Afrechillo',15::numeric,3,2.4000::numeric,24.0000::numeric,0.24::numeric,0.0360::numeric,'ULTIMO_LOTE'::text),
    ('for-001','i-3','Núcleo Vitamínico',5::numeric,4,0.1000::numeric,1.0000::numeric,1.95::numeric,0.0975::numeric,'ULTIMO_LOTE'::text),
    ('for-001','i-4','Sal',2::numeric,5,0.0000::numeric,0.0000::numeric,0.18::numeric,0.0036::numeric,'ULTIMO_LOTE'::text),
    ('for-002','i-1','Maíz',42::numeric,1,3.5700::numeric,35.7000::numeric,0.29::numeric,0.1218::numeric,'ULTIMO_LOTE'::text),
    ('for-002','i-2','Soja',34::numeric,2,14.9600::numeric,149.6000::numeric,0.41::numeric,0.1394::numeric,'ULTIMO_LOTE'::text),
    ('for-002','i-5','Afrechillo',18::numeric,3,2.8800::numeric,28.8000::numeric,0.24::numeric,0.0432::numeric,'ULTIMO_LOTE'::text),
    ('for-002','i-3','Núcleo Vitamínico',4::numeric,4,0.0800::numeric,0.8000::numeric,1.95::numeric,0.0780::numeric,'ULTIMO_LOTE'::text),
    ('for-002','i-4','Sal',2::numeric,5,0.0000::numeric,0.0000::numeric,0.18::numeric,0.0036::numeric,'ULTIMO_LOTE'::text)
) as x(legacy_formula_uid, legacy_insumo_uid, nombre_insumo, porcentaje, orden, aporte_proteina_pct, aporte_proteina_g_kg, costo_unitario_usado, costo_contribucion_kg, fuente_costo)
join public.formulas f on f.legacy_uid = x.legacy_formula_uid
join public.insumos i on i.legacy_uid = x.legacy_insumo_uid;

-- 6) Ordenes de producción
with usr_sergio as (
  select id from public.usuarios where legacy_uid = 'usr-101' limit 1
), usr_edwin as (
  select id from public.usuarios where legacy_uid = 'usr-102' limit 1
)
insert into public.ordenes_produccion (
  legacy_uid, lote, formula_id, id_formula_legacy, nombre_producto, version_formula,
  cantidad_objetivo, cantidad_real, merma_manual,
  silo_id, id_silo_legacy, destino_silo,
  estado, fecha_creacion, usuario_responsable, usuario_id, costo_total_insumos
)
select * from (
  select
    'OP-2026-101'::text,
    'OP-2026-101'::text,
    (select id from public.formulas where legacy_uid = 'for-001'),
    'for-001'::text,
    'Alimento Lechera'::text,
    2::int,
    2000::numeric,
    null::numeric,
    145::numeric,
    null::uuid,
    null::text,
    null::text,
    'PENDIENTE'::text,
    '2026-05-17T10:00:00Z'::timestamptz,
    'Sergio Monzón'::text,
    (select id from usr_sergio),
    702.4::numeric
  union all
  select
    'OP-2026-102','OP-2026-102',
    (select id from public.formulas where legacy_uid = 'for-002'),
    'for-002','Pellet Cerdo Crecimiento',1,
    3000::numeric,null::numeric,null::numeric,
    null::uuid,null::text,null::text,
    'EN PROCESO','2026-05-17T11:30:00Z','Edwin',(select id from usr_edwin),1018.2::numeric
  union all
  select
    'OP-2026-103','OP-2026-103',
    (select id from public.formulas where legacy_uid = 'for-001'),
    'for-001','Alimento Lechera',2,
    1800::numeric,1765::numeric,35::numeric,
    (select id from public.silos where legacy_uid = 'silo-003'),
    'silo-003','Silo Lechera',
    'FINALIZADO','2026-05-16T09:00:00Z','Sergio Monzón',(select id from usr_sergio),632.16::numeric
) as t(
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

-- 7) Orden consumo lotes (reset controlado solo para órdenes seeded)
delete from public.orden_consumo_lotes
where orden_id in (
  select id from public.ordenes_produccion where legacy_uid in ('OP-2026-101','OP-2026-102','OP-2026-103')
);

insert into public.orden_consumo_lotes (
  orden_id, lote_id, id_lote_legacy, insumo_id, id_insumo_legacy, nombre_insumo,
  cantidad_usada, tipo_unidad, costo_unitario, costo_total
)
select
  o.id,
  l.id,
  x.id_lote_legacy,
  i.id,
  x.id_insumo_legacy,
  x.nombre_insumo,
  x.cantidad_usada,
  x.tipo_unidad,
  x.costo_unitario,
  x.costo_total
from (
  values
    ('OP-2026-101','stk-001','i-1','Maíz',960::numeric,'KG',0.29::numeric,278.4::numeric),
    ('OP-2026-101','stk-002','i-2','Soja',600::numeric,'KG',0.41::numeric,246::numeric),
    ('OP-2026-101','stk-005','i-5','Afrechillo',300::numeric,'KG',0.24::numeric,72::numeric),
    ('OP-2026-101','stk-003','i-3','Núcleo Vitamínico',100::numeric,'KG',1.95::numeric,195::numeric),
    ('OP-2026-101','stk-004','i-4','Sal',40::numeric,'KG',0.18::numeric,7.2::numeric),

    ('OP-2026-102','stk-001','i-1','Maíz',1260::numeric,'KG',0.29::numeric,365.4::numeric),
    ('OP-2026-102','stk-002','i-2','Soja',1020::numeric,'KG',0.41::numeric,418.2::numeric),
    ('OP-2026-102','stk-005','i-5','Afrechillo',540::numeric,'KG',0.24::numeric,129.6::numeric),
    ('OP-2026-102','stk-003','i-3','Núcleo Vitamínico',120::numeric,'KG',1.95::numeric,234::numeric),
    ('OP-2026-102','stk-004','i-4','Sal',60::numeric,'KG',0.18::numeric,10.8::numeric),

    ('OP-2026-103','stk-001','i-1','Maíz',864::numeric,'KG',0.29::numeric,250.56::numeric),
    ('OP-2026-103','stk-002','i-2','Soja',540::numeric,'KG',0.41::numeric,221.4::numeric),
    ('OP-2026-103','stk-005','i-5','Afrechillo',270::numeric,'KG',0.24::numeric,64.8::numeric),
    ('OP-2026-103','stk-003','i-3','Núcleo Vitamínico',90::numeric,'KG',1.95::numeric,175.5::numeric),
    ('OP-2026-103','stk-004','i-4','Sal',36::numeric,'KG',0.18::numeric,6.48::numeric)
) as x(id_orden_legacy, id_lote_legacy, id_insumo_legacy, nombre_insumo, cantidad_usada, tipo_unidad, costo_unitario, costo_total)
join public.ordenes_produccion o on o.legacy_uid = x.id_orden_legacy
left join public.stock_lotes_mp l on l.legacy_uid = x.id_lote_legacy
left join public.insumos i on i.legacy_uid = x.id_insumo_legacy;

-- 8) Stock PT mínimo (1 registro finalizado)
insert into public.stock_pt (
  legacy_uid, orden_id, id_orden_legacy, numero_orden, nombre_producto,
  cantidad_total, lote, unidad_medida, estado,
  silo_id, id_silo_legacy, nombre_silo,
  detalle_insumos, fecha_ingreso, usuario
)
values (
  'pt-001',
  (select id from public.ordenes_produccion where legacy_uid = 'OP-2026-103'),
  'OP-2026-103',
  'OP-2026-103',
  'Alimento Lechera',
  1765,
  'PT-2026-103',
  'KG',
  'OK',
  (select id from public.silos where legacy_uid = 'silo-003'),
  'silo-003',
  'Silo Lechera',
  '[{"id_lote":"stk-001","nombre_lote":"MZ-2505-A","id_insumo":"i-1","nombre_insumo":"Maíz","cantidad":864,"unidad_medida":"KG"}]'::jsonb,
  '2026-05-16T12:00:00Z'::timestamptz,
  'Sergio Monzón'
)
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

-- 9) Trazabilidad eventos mínimo
insert into public.trazabilidad_eventos (
  legacy_uid, orden_id, stock_lote_mp_id, stock_pt_id, tipo, referencia, payload, fecha_evento, usuario_id
)
select
  e.legacy_uid,
  o.id,
  l.id,
  pt.id,
  e.tipo,
  e.referencia,
  e.payload,
  e.fecha_evento,
  u.id
from (
  values
    ('trz-001','OP-2026-103','stk-001','pt-001','CONSUMO_MP','Consumo de maíz en orden finalizada','{"cantidad":864,"unidad":"KG"}'::jsonb,'2026-05-16T09:10:00Z'::timestamptz,'usr-101'),
    ('trz-002','OP-2026-103',null,'pt-001','PRODUCCION_FIN','Cierre de orden OP-2026-103','{"cantidad_real":1765,"merma":35}'::jsonb,'2026-05-16T11:50:00Z'::timestamptz,'usr-101'),
    ('trz-003','OP-2026-102','stk-001',null,'RESERVA_MP','Reserva stock tránsito OP-2026-102','{"cantidad":1200,"unidad":"KG"}'::jsonb,'2026-05-17T11:35:00Z'::timestamptz,'usr-102')
) as e(legacy_uid, orden_legacy_uid, lote_legacy_uid, pt_legacy_uid, tipo, referencia, payload, fecha_evento, usuario_legacy_uid)
left join public.ordenes_produccion o on o.legacy_uid = e.orden_legacy_uid
left join public.stock_lotes_mp l on l.legacy_uid = e.lote_legacy_uid
left join public.stock_pt pt on pt.legacy_uid = e.pt_legacy_uid
left join public.usuarios u on u.legacy_uid = e.usuario_legacy_uid
on conflict (legacy_uid) do update set
  orden_id = excluded.orden_id,
  stock_lote_mp_id = excluded.stock_lote_mp_id,
  stock_pt_id = excluded.stock_pt_id,
  tipo = excluded.tipo,
  referencia = excluded.referencia,
  payload = excluded.payload,
  fecha_evento = excluded.fecha_evento,
  usuario_id = excluded.usuario_id;
