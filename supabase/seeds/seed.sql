-- Sprint 1 seed from current frontend mocks

insert into public.roles (code, nombre, descripcion)
values
  ('ADMIN', 'Administrador', 'Acceso administrativo total'),
  ('OPERADOR', 'Operador', 'Gestión operativa')
on conflict (code) do nothing;

with role_admin as (
  select id from public.roles where code = 'ADMIN' limit 1
)
insert into public.usuarios (legacy_uid, role_id, nombre, email, esta_activo)
select 'usr-admin-01', role_admin.id, 'Usuario Admin', 'admin@nutribalance.local', true
from role_admin
on conflict (legacy_uid) do nothing;

insert into public.proveedores (
  legacy_uid, nombre_empresa, contacto_nombre, telefono, email, direccion, documento, esta_activo
)
values
  ('p-1', 'Molinos del Sur S.A.', 'Carlos Mendoza', '987654321', 'ventas@molinos.com', 'Av. Industrial 123, Arequipa', '20123456789', true),
  ('p-2', 'Importaciones Agro', 'Lucía Torres', '912333444', 'lucia@agroperu.pe', 'Calle Lima 456, Lima', '20555666777', true)
on conflict (legacy_uid) do update set
  nombre_empresa = excluded.nombre_empresa,
  contacto_nombre = excluded.contacto_nombre,
  telefono = excluded.telefono,
  email = excluded.email,
  direccion = excluded.direccion,
  documento = excluded.documento,
  esta_activo = excluded.esta_activo;

insert into public.insumos (
  legacy_uid, nombre, unidad_medida, categoria, umbral_alerta, ref_costo_unitario, esta_activo
)
values
  ('i-1', 'Maíz Amarillo', 'kg', 'Grano', 500, 10, true),
  ('i-2', 'Núcleo Vitamínico', 'kg', 'Suplemento', 50, 6, true)
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  unidad_medida = excluded.unidad_medida,
  categoria = excluded.categoria,
  umbral_alerta = excluded.umbral_alerta,
  ref_costo_unitario = excluded.ref_costo_unitario,
  esta_activo = excluded.esta_activo;

insert into public.silos (legacy_uid, nombre, descripcion, esta_activo)
values
  ('silo-001', 'Silo grano G3', 'Almacenamiento principal de maíz amarillo y granos de alta densidad.', true),
  ('silo-002', 'Silo torta T1', 'Depósito especializado para torta de soya y subproductos de molienda.', true),
  ('silo-003', 'Bodega MP-A', 'Zona de almacenamiento para sacos de harina de pescado y aditivos a granel.', true)
on conflict (legacy_uid) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  esta_activo = excluded.esta_activo;

with usr as (
  select id from public.usuarios where legacy_uid = 'usr-admin-01' limit 1
), lotes as (
  select * from (
    values
      ('stk-001', 'i-2', 'p-1', 'OP-20215', 'GR-001-5542', 'Silo A1', 10000::numeric, 5000::numeric, 1200::numeric, 1.45::numeric, 14500::numeric, '2026-05-10T08:30:00Z'::timestamptz, '2026-05-10T08:35:00Z'::timestamptz, '2026-05-10T10:00:00Z'::timestamptz),
      ('stk-002', 'i-1', 'p-2', 'L-SOY-998', 'FAC-002-8871', 'Almacén Norte', 2500::numeric, 2500::numeric, 0::numeric, 2.80::numeric, 7000::numeric, '2026-05-11T09:00:00Z'::timestamptz, '2026-05-11T09:15:00Z'::timestamptz, '2026-05-11T09:15:00Z'::timestamptz)
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
