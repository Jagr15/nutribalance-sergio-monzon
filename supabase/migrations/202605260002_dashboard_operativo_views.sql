-- FASE 4: vistas operativas para dashboard, alertas y trazabilidad

create or replace view public.vw_dashboard_stock_resumen as
with mp as (
  select
    coalesce(sum(sl.cantidad_actual), 0)::numeric(14,3) as stock_total_mp,
    coalesce(sum(sl.costo_total * case when sl.cantidad_inicial > 0 then sl.cantidad_actual / sl.cantidad_inicial else 0 end), 0)::numeric(14,3) as valor_inventario_mp,
    coalesce(sum(case when sl.cantidad_actual - sl.cantidad_comprometida <= coalesce(i.umbral_alerta, 0) then 1 else 0 end), 0)::int as stock_critico
  from public.stock_lotes_mp sl
  join public.insumos i on i.id = sl.insumo_id
  where sl.deleted_at is null
    and i.deleted_at is null
),
pt as (
  select coalesce(sum(sp.cantidad_total), 0)::numeric(14,3) as stock_total_pt,
    coalesce(sum(sp.cantidad_total * (case when op.cantidad_real > 0 then op.costo_total_insumos / op.cantidad_real else 0 end)), 0)::numeric(14,3) as valor_inventario_pt
  from public.stock_pt sp
  left join public.ordenes_produccion op on op.id = sp.orden_id
  where sp.deleted_at is null
)
select
  mp.stock_total_mp,
  mp.stock_critico,
  mp.valor_inventario_mp,
  pt.stock_total_pt,
  pt.valor_inventario_pt
from mp, pt;

create or replace view public.vw_dashboard_produccion_resumen as
with ord as (
  select *
  from public.ordenes_produccion
  where deleted_at is null
),
trz as (
  select orden_id,
    bool_or(tipo = 'CONSUMO_MP') as has_consumo,
    bool_or(tipo = 'PRODUCCION_FIN') as has_fin,
    bool_or(tipo = 'INGRESO_PT') as has_ingreso_pt
  from public.trazabilidad_eventos
  group by orden_id
)
select
  coalesce(sum(case when estado = 'PENDIENTE' then 1 else 0 end), 0)::int as ordenes_pendientes,
  coalesce(sum(case when estado = 'EN PROCESO' then 1 else 0 end), 0)::int as ordenes_en_proceso,
  coalesce(sum(case when estado = 'FINALIZADO' then 1 else 0 end), 0)::int as ordenes_finalizadas,
  coalesce(sum(case when estado = 'FINALIZADO' then cantidad_real else 0 end), 0)::numeric(14,3) as produccion_total,
  coalesce(avg(case when estado = 'FINALIZADO' and cantidad_real > 0 then costo_total_insumos / cantidad_real end), 0)::numeric(14,6) as costo_promedio_produccion,
  coalesce(sum(case when estado = 'FINALIZADO' then coalesce(merma_manual, 0) else 0 end), 0)::numeric(14,3) as merma_total,
  coalesce(sum(
    case when estado = 'FINALIZADO' and not coalesce((trz.has_consumo and trz.has_fin and trz.has_ingreso_pt), false) then 1 else 0 end
  ), 0)::int as produccion_sin_trazabilidad
from ord
left join trz on trz.orden_id = ord.id;

create or replace view public.vw_dashboard_costos_resumen as
with formula_totals as (
  select
    f.id,
    f.legacy_uid,
    f.nombre_producto,
    coalesce(sum(fi.porcentaje), 0)::numeric(10,4) as formula_total_pct,
    coalesce(sum((fi.porcentaje / 100.0) * coalesce(i.proteina_bruta_pct, 0)), 0)::numeric(10,4) as proteina_formula_pct
  from public.formulas f
  left join public.formula_ingredientes fi on fi.formula_id = f.id
  left join public.insumos i on i.id = fi.insumo_id
  where f.deleted_at is null
  group by f.id, f.legacy_uid, f.nombre_producto
),
consumo as (
  select
    date_trunc('month', o.fecha_creacion)::date as mes,
    ocl.nombre_insumo,
    sum(ocl.cantidad_usada)::numeric(14,3) as consumo_kg
  from public.orden_consumo_lotes ocl
  join public.ordenes_produccion o on o.id = ocl.orden_id
  where o.deleted_at is null
  group by 1, 2
)
select
  coalesce(avg(ft.proteina_formula_pct), 0)::numeric(10,4) as proteina_promedio_formula,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id_formula', ft.legacy_uid,
        'nombre_producto', ft.nombre_producto,
        'total_pct', ft.formula_total_pct,
        'proteina_pct', ft.proteina_formula_pct
      )
      order by ft.nombre_producto
    ) filter (where ft.id is not null),
    '[]'::jsonb
  ) as formulas,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'mes', to_char(c.mes, 'YYYY-MM'),
          'insumo', c.nombre_insumo,
          'consumo_kg', c.consumo_kg
        ) order by c.mes, c.nombre_insumo
      )
      from consumo c
    ),
    '[]'::jsonb
  ) as consumo_mensual
from formula_totals ft;

create or replace view public.vw_dashboard_alertas_operativas as
with stock_bajo as (
  select
    'stock_bajo_minimo:' || sl.id::text as alerta_id,
    'Stock bajo mínimo'::text as tipo,
    'critica'::text as prioridad,
    'stock'::text as area,
    format('El lote %s (%s) está por debajo del umbral.', sl.lote, i.nombre) as titulo,
    jsonb_build_object('lote', sl.lote, 'insumo', i.nombre) as dato_asociado,
    now() as fecha_evento
  from public.stock_lotes_mp sl
  join public.insumos i on i.id = sl.insumo_id
  where sl.deleted_at is null
    and i.deleted_at is null
    and (sl.cantidad_actual - sl.cantidad_comprometida) <= coalesce(i.umbral_alerta, 0)
),
lote_sin_costo as (
  select
    'lote_sin_costo:' || sl.id::text,
    'Lote sin costo'::text,
    'media'::text,
    'costos'::text,
    format('El lote %s no tiene costo unitario válido.', sl.lote),
    jsonb_build_object('lote', sl.lote, 'insumo', i.nombre),
    now()
  from public.stock_lotes_mp sl
  join public.insumos i on i.id = sl.insumo_id
  where sl.deleted_at is null
    and (coalesce(sl.costo_unitario, 0) <= 0 or coalesce(sl.costo_total, 0) <= 0)
),
insumo_sin_pb as (
  select
    'insumo_sin_pb:' || i.id::text,
    'Insumo sin PB'::text,
    'media'::text,
    'costos'::text,
    format('El insumo %s no tiene proteína bruta configurada.', i.nombre),
    jsonb_build_object('insumo', i.nombre),
    now()
  from public.insumos i
  where i.deleted_at is null
    and (i.proteina_bruta_pct is null or i.proteina_bruta_pct <= 0)
),
formula_fuera as (
  select
    'formula_fuera_100:' || f.id::text,
    'Fórmula fuera de 100%'::text,
    'critica'::text,
    'produccion'::text,
    format('La fórmula %s suma %s%%.', f.nombre_producto, round(sum(fi.porcentaje)::numeric, 2)),
    jsonb_build_object('producto', f.nombre_producto),
    now()
  from public.formulas f
  join public.formula_ingredientes fi on fi.formula_id = f.id
  where f.deleted_at is null
  group by f.id, f.nombre_producto
  having abs(sum(fi.porcentaje) - 100) > 0.01
),
merma_alta as (
  select
    'merma_alta:' || o.id::text,
    'Merma alta'::text,
    'critica'::text,
    'produccion'::text,
    format('La orden %s reporta merma alta (%s kg).', coalesce(o.legacy_uid, o.lote), round(coalesce(o.merma_manual, 0)::numeric, 2)),
    jsonb_build_object('orden', coalesce(o.legacy_uid, o.lote), 'producto', o.nombre_producto),
    o.updated_at
  from public.ordenes_produccion o
  where o.deleted_at is null
    and o.estado = 'FINALIZADO'
    and coalesce(o.merma_manual, 0) > greatest(100, coalesce(o.cantidad_objetivo, 0) * 0.05)
),
silo_saturado as (
  select
    'silo_saturado:' || coalesce(sp.silo_id::text, 'sin-silo'),
    'Silo saturado'::text,
    'media'::text,
    'productos'::text,
    format('El silo %s acumula %s lotes PT activos.', coalesce(sp.nombre_silo, 'Sin silo'), count(*)::text),
    jsonb_build_object('lote', coalesce(sp.nombre_silo, 'Sin silo'), 'producto', 'PT'),
    now()
  from public.stock_pt sp
  where sp.deleted_at is null
  group by sp.silo_id, sp.nombre_silo
  having count(*) >= 5
),
trazabilidad_incompleta as (
  with t as (
    select orden_id,
      bool_or(tipo = 'CONSUMO_MP') as has_consumo,
      bool_or(tipo = 'PRODUCCION_FIN') as has_fin,
      bool_or(tipo = 'INGRESO_PT') as has_ingreso_pt
    from public.trazabilidad_eventos
    group by orden_id
  )
  select
    'trazabilidad_incompleta:' || o.id::text,
    'Producción sin trazabilidad completa'::text,
    'critica'::text,
    'produccion'::text,
    format('La orden %s no tiene eventos completos de trazabilidad.', coalesce(o.legacy_uid, o.lote)),
    jsonb_build_object('orden', coalesce(o.legacy_uid, o.lote), 'producto', o.nombre_producto),
    o.updated_at
  from public.ordenes_produccion o
  left join t on t.orden_id = o.id
  where o.deleted_at is null
    and o.estado = 'FINALIZADO'
    and not coalesce((t.has_consumo and t.has_fin and t.has_ingreso_pt), false)
)
select * from stock_bajo
union all select * from lote_sin_costo
union all select * from insumo_sin_pb
union all select * from formula_fuera
union all select * from merma_alta
union all select * from silo_saturado
union all select * from trazabilidad_incompleta;

create or replace view public.vw_dashboard_trazabilidad as
select
  te.id,
  te.fecha_evento,
  te.tipo,
  te.referencia,
  te.payload,
  op.legacy_uid as orden_legacy_uid,
  op.lote as orden_lote,
  op.nombre_producto,
  sl.legacy_uid as lote_mp_legacy_uid,
  sl.lote as lote_mp,
  sp.legacy_uid as stock_pt_legacy_uid,
  sp.lote as lote_pt,
  sp.nombre_silo as silo_destino
from public.trazabilidad_eventos te
left join public.ordenes_produccion op on op.id = te.orden_id
left join public.stock_lotes_mp sl on sl.id = te.stock_lote_mp_id
left join public.stock_pt sp on sp.id = te.stock_pt_id
order by te.fecha_evento desc;
