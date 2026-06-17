-- FASE 5: Comparativa de costos formulados vs reales

create or replace view public.vw_costos_formula_vs_real as
with formulas_base as (
  select
    coalesce(f.legacy_uid, f.nombre_producto || '::' || coalesce(f.version::text, '0')) as clave_formula,
    f.legacy_uid as producto_formula_id,
    f.nombre_producto,
    f.version as version_formula,
    coalesce(f.costo_por_kg, 0)::numeric(14,6) as costo_formulado_kg,
    coalesce(f.costo_por_tonelada, coalesce(f.costo_por_kg, 0) * 1000)::numeric(14,6) as costo_formulado_ton
  from public.formulas f
  where f.deleted_at is null
),
ops_agg as (
  select
    coalesce(op.id_formula_legacy, op.nombre_producto || '::' || coalesce(op.version_formula::text, '0')) as clave_formula,
    max(op.id_formula_legacy) as producto_formula_id,
    max(op.nombre_producto) as nombre_producto,
    max(op.version_formula) as version_formula,
    coalesce(sum(op.costo_total_insumos), 0)::numeric(14,6) as costo_total_insumos,
    coalesce(sum(coalesce(op.cantidad_real, op.cantidad_objetivo)), 0)::numeric(14,6) as cantidad_real_total,
    (array_agg(op.lote order by op.fecha_creacion desc))[1] as ultima_op,
    max(op.fecha_creacion) as ultima_fecha
  from public.ordenes_produccion op
  where op.deleted_at is null
    and op.estado = 'FINALIZADO'
  group by 1
)
select
  coalesce(f.producto_formula_id, o.producto_formula_id, o.clave_formula) as producto_formula_id,
  coalesce(f.nombre_producto, o.nombre_producto, 'Sin dato') as nombre_producto,
  coalesce(f.version_formula, o.version_formula) as version_formula,
  coalesce(f.costo_formulado_kg, 0)::numeric(14,6) as costo_formulado_kg,
  coalesce(f.costo_formulado_ton, coalesce(f.costo_formulado_kg, 0) * 1000)::numeric(14,6) as costo_formulado_ton,
  case
    when coalesce(o.cantidad_real_total, 0) > 0
      then (o.costo_total_insumos / o.cantidad_real_total)::numeric(14,6)
    else 0::numeric(14,6)
  end as costo_real_kg,
  case
    when coalesce(o.cantidad_real_total, 0) > 0
      then (o.costo_total_insumos / o.cantidad_real_total * 1000)::numeric(14,6)
    else 0::numeric(14,6)
  end as costo_real_ton,
  case
    when coalesce(o.cantidad_real_total, 0) > 0
      then ((o.costo_total_insumos / o.cantidad_real_total) - coalesce(f.costo_formulado_kg, 0))::numeric(14,6)
    else (-coalesce(f.costo_formulado_kg, 0))::numeric(14,6)
  end as variacion_abs,
  case
    when coalesce(f.costo_formulado_kg, 0) > 0
      then (
        (
          case
            when coalesce(o.cantidad_real_total, 0) > 0
              then (o.costo_total_insumos / o.cantidad_real_total)
            else 0
          end - coalesce(f.costo_formulado_kg, 0)
        ) / coalesce(f.costo_formulado_kg, 1)
      ) * 100
    else 0
  end::numeric(14,6) as variacion_pct,
  o.ultima_op,
  o.ultima_fecha
from formulas_base f
left join ops_agg o on o.clave_formula = f.clave_formula

union all

select
  o.producto_formula_id,
  o.nombre_producto,
  o.version_formula,
  0::numeric(14,6) as costo_formulado_kg,
  0::numeric(14,6) as costo_formulado_ton,
  case
    when coalesce(o.cantidad_real_total, 0) > 0
      then (o.costo_total_insumos / o.cantidad_real_total)::numeric(14,6)
    else 0::numeric(14,6)
  end as costo_real_kg,
  case
    when coalesce(o.cantidad_real_total, 0) > 0
      then (o.costo_total_insumos / o.cantidad_real_total * 1000)::numeric(14,6)
    else 0::numeric(14,6)
  end as costo_real_ton,
  case
    when coalesce(o.cantidad_real_total, 0) > 0
      then (o.costo_total_insumos / o.cantidad_real_total)::numeric(14,6)
    else 0::numeric(14,6)
  end as variacion_abs,
  0::numeric(14,6) as variacion_pct,
  o.ultima_op,
  o.ultima_fecha
from ops_agg o
left join formulas_base f on f.clave_formula = o.clave_formula
where f.clave_formula is null;
