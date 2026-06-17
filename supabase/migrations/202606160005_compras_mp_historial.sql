create or replace view public.historial_compras_mp as
select
  p.nombre_empresa as proveedor,
  p.legacy_uid as id_proveedor,
  i.nombre as insumo,
  i.legacy_uid as id_insumo,
  sl.fecha_ingreso as fecha_compra,
  sl.lote,
  sl.cantidad_inicial::numeric(14,3) as cantidad,
  sl.costo_unitario::numeric(14,6) as costo_unitario,
  sl.costo_total::numeric(14,6) as costo_total
from public.stock_lotes_mp sl
join public.insumos i on i.id = sl.insumo_id
join public.proveedores p on p.id = sl.proveedor_id
where sl.deleted_at is null
  and i.deleted_at is null
  and p.deleted_at is null;

create or replace view public.ultimo_precio_pagado_insumo as
with compras_ordenadas as (
  select
    i.legacy_uid as id_insumo,
    i.nombre as insumo,
    p.legacy_uid as id_proveedor,
    p.nombre_empresa as ultimo_proveedor,
    sl.fecha_ingreso as fecha_ultima_compra,
    sl.costo_unitario::numeric(14,6) as ultimo_precio,
    lead(sl.costo_unitario::numeric(14,6)) over (
      partition by i.id
      order by sl.fecha_ingreso desc, sl.created_at desc, sl.id desc
    ) as precio_compra_anterior,
    row_number() over (
      partition by i.id
      order by sl.fecha_ingreso desc, sl.created_at desc, sl.id desc
    ) as rn
  from public.stock_lotes_mp sl
  join public.insumos i on i.id = sl.insumo_id
  join public.proveedores p on p.id = sl.proveedor_id
  where sl.deleted_at is null
    and i.deleted_at is null
    and p.deleted_at is null
)
select
  insumo,
  id_insumo,
  ultimo_proveedor,
  id_proveedor,
  fecha_ultima_compra,
  ultimo_precio,
  precio_compra_anterior,
  (ultimo_precio - precio_compra_anterior)::numeric(14,6) as variacion_absoluta,
  case
    when precio_compra_anterior is null or precio_compra_anterior = 0 then null
    else round(((ultimo_precio - precio_compra_anterior) / precio_compra_anterior) * 100, 2)
  end as variacion_pct
from compras_ordenadas
where rn = 1;
