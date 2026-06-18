create or replace view public.vw_ingresos_pt_por_producto as
with ingresos_financieros as (
  select
    f.stock_pt_id,
    sum(f.monto)::numeric(16,2) as importe_total,
    max(f.fecha) as ultima_fecha
  from public.flujo_caja_movimientos f
  left join public.categorias_financieras cf on cf.id = f.categoria_id
  where f.deleted_at is null
    and f.estado = 'CONFIRMADO'
    and f.tipo = 'INGRESO'
    and (
      f.origen_operativo = 'VENTA'
      or cf.legacy_uid = 'cat-ventas'
    )
    and f.stock_pt_id is not null
  group by f.stock_pt_id
),
salidas as (
  select
    m.stock_pt_id,
    coalesce(nullif(trim(m.nombre_producto), ''), 'Sin producto') as producto,
    m.cantidad,
    m.valor_total,
    m.costo_unitario,
    m.cliente_id,
    m.created_at,
    i.importe_total as importe_financiero,
    i.ultima_fecha as fecha_financiera
  from public.stock_pt_movimientos m
  left join ingresos_financieros i on i.stock_pt_id = m.stock_pt_id
  where m.tipo in ('SALIDA', 'DESPACHO_PT')
),
lotes as (
  select
    stock_pt_id,
    producto,
    sum(cantidad)::numeric(14,3) as cantidad_kg,
    coalesce(max(importe_financiero), sum(coalesce(valor_total, cantidad * coalesce(costo_unitario, 0))))::numeric(16,2) as importe_total,
    max(greatest(created_at, coalesce(fecha_financiera, created_at))) as ultima_fecha
  from salidas
  group by stock_pt_id, producto
),
clientes as (
  select
    producto,
    count(distinct cliente_id)::integer as clientes_count
  from salidas
  where cliente_id is not null
  group by producto
),
totales as (
  select
    producto,
    sum(cantidad_kg)::numeric(14,3) as cantidad_kg,
    sum(importe_total)::numeric(16,2) as importe_total,
    max(ultima_fecha) as ultima_fecha
  from lotes
  group by producto
)
select
  t.producto,
  t.cantidad_kg,
  t.importe_total,
  coalesce(c.clientes_count, 0) as clientes_count,
  t.ultima_fecha
from totales t
left join clientes c using (producto)
order by t.importe_total desc, t.cantidad_kg desc;

create or replace view public.vw_finanzas_reportes as
with base as (
  select
    date_trunc('month', f.fecha)::date as mes,
    f.tipo,
    coalesce(cf.nombre, 'Sin categoría') as categoria,
    f.monto,
    coalesce(f.origen_operativo, 'MANUAL') as origen_operativo,
    cf.legacy_uid as categoria_legacy_uid
  from public.flujo_caja_movimientos f
  left join public.categorias_financieras cf on cf.id = f.categoria_id
  where f.deleted_at is null
    and f.estado = 'CONFIRMADO'
),
rentabilidad as (
  select
    coalesce(o.id_formula_legacy, 'SIN_FORMULA') as id_formula,
    o.nombre_producto,
    sum(coalesce(o.costo_total_insumos, 0))::numeric(16,2) as costo_total,
    sum(coalesce(o.cantidad_real, 0))::numeric(16,3) as kg_total
  from public.ordenes_produccion o
  where o.deleted_at is null
    and o.estado = 'FINALIZADO'
  group by 1, 2
)
select jsonb_build_object(
  'flujo_caja_mensual', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'mes', to_char(x.mes, 'YYYY-MM'),
      'ingresos', x.ingresos,
      'egresos', x.egresos,
      'neto', x.neto
    ) order by x.mes), '[]'::jsonb)
    from (
      select
        mes,
        sum(case when tipo = 'INGRESO' then monto else 0 end) as ingresos,
        sum(case when tipo = 'EGRESO' then monto else 0 end) as egresos,
        sum(case when tipo = 'INGRESO' then monto else -monto end) as neto
      from base
      group by mes
    ) x
  ),
  'gastos_por_categoria', (
    select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'monto', total) order by total desc), '[]'::jsonb)
    from (select categoria, sum(monto)::numeric(16,2) as total from base where tipo = 'EGRESO' group by categoria) g
  ),
  'ingresos_por_categoria', (
    select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'monto', total) order by total desc), '[]'::jsonb)
    from (
      select categoria, sum(monto)::numeric(16,2) as total
      from base
      where tipo = 'INGRESO'
        and coalesce(categoria_legacy_uid, '') <> 'cat-ventas'
      group by categoria
    ) i
  ),
  'ingresos_pt_por_producto', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'producto', producto,
      'cantidad_kg', cantidad_kg,
      'importe_total', importe_total,
      'clientes_count', clientes_count,
      'ultima_fecha', ultima_fecha
    ) order by importe_total desc, cantidad_kg desc), '[]'::jsonb)
    from public.vw_ingresos_pt_por_producto
  ),
  'rentabilidad_por_formula', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id_formula', id_formula,
      'nombre_producto', nombre_producto,
      'costo_total', costo_total,
      'kg_total', kg_total,
      'costo_promedio_kg', case when kg_total > 0 then costo_total / kg_total else 0 end
    ) order by costo_total desc), '[]'::jsonb)
    from rentabilidad
  ),
  'costo_operativo_mensual', (
    select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(mes, 'YYYY-MM'), 'monto', total) order by mes), '[]'::jsonb)
    from (select mes, sum(monto)::numeric(16,2) as total from base where tipo = 'EGRESO' group by mes) c
  )
) as payload;
