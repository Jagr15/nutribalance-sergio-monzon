create or replace view public.historial_compras_mp as
select
  coalesce(p.nombre_empresa, sl.proveedor_id::text, 'Sin proveedor') as proveedor,
  coalesce(p.legacy_uid, sl.proveedor_id::text) as id_proveedor,
  coalesce(i.nombre, sl.insumo_id::text, 'Sin insumo') as insumo,
  coalesce(i.legacy_uid, sl.insumo_id::text) as id_insumo,
  sl.fecha_ingreso as fecha_compra,
  sl.lote,
  sl.cantidad_inicial::numeric(14,3) as cantidad,
  sl.costo_unitario::numeric(14,6) as costo_unitario,
  sl.costo_total::numeric(14,6) as costo_total,
  sl.remito_nro
from public.stock_lotes_mp sl
left join public.insumos i
  on i.id::text = sl.insumo_id::text
  or i.legacy_uid = sl.insumo_id::text
left join public.proveedores p
  on p.id::text = sl.proveedor_id::text
  or p.legacy_uid = sl.proveedor_id::text
where sl.deleted_at is null;
