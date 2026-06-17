create or replace view public.vw_movimientos_mp_auditoria as
select
  sm.created_at as fecha,
  sm.tipo as tipo_movimiento,
  i.nombre as insumo,
  sl.lote as lote_mp,
  sm.cantidad,
  i.unidad_medida as unidad,
  coalesce(op.legacy_uid, sm.metadata->>'orden_legacy_uid') as op_relacionada,
  coalesce(op.lote, sm.metadata->>'orden_legacy_uid') as op_lote,
  sm.origen,
  sm.observaciones
from public.stock_movimientos sm
join public.stock_lotes_mp sl on sl.id = sm.lote_id
join public.insumos i on i.id = sl.insumo_id
left join public.ordenes_produccion op
  on op.id = nullif(sm.metadata->>'orden_id', '')::uuid
where sl.deleted_at is null;

create or replace view public.vw_trazabilidad_por_op as
select
  op.id as op_id,
  op.legacy_uid as orden_legacy_uid,
  op.lote as numero_orden,
  op.nombre_producto as producto,
  op.id_formula_legacy as formula,
  op.version_formula,
  op.estado as estado_op,
  op.cantidad_objetivo,
  op.cantidad_real,
  op.merma_manual,
  op.destino_silo,
  op.usuario_responsable,
  op.fecha_creacion,
  op.updated_at as actualizada_en,
  coalesce(mp.mp_planificada, '[]'::jsonb) as mp_planificada,
  coalesce(mp.lotes_mp_usados, '[]'::jsonb) as lotes_mp_usados,
  coalesce(mp_mov.mp_movimientos, '[]'::jsonb) as mp_movimientos,
  coalesce(ptg.pt_generado, '[]'::jsonb) as pt_generado,
  coalesce(pts.salidas_pt, '[]'::jsonb) as salidas_pt,
  coalesce(ev.eventos, '[]'::jsonb) as eventos
from public.ordenes_produccion op
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'insumo', i.nombre,
        'lote_mp', coalesce(sl.legacy_uid, sl.lote),
        'cantidad', ocl.cantidad_usada,
        'unidad', ocl.tipo_unidad,
        'costo_unitario', ocl.costo_unitario,
        'costo_total', ocl.costo_total
      )
      order by ocl.id
    ) filter (where ocl.id is not null) as mp_planificada,
    array_agg(distinct coalesce(sl.legacy_uid, sl.lote)) filter (where sl.id is not null) as lotes_mp_usados
  from public.orden_consumo_lotes ocl
  left join public.stock_lotes_mp sl
    on sl.id = ocl.lote_id
    and sl.deleted_at is null
  left join public.insumos i
    on i.id = sl.insumo_id
  where ocl.orden_id = op.id
) mp on true
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'tipo', sm.tipo,
        'insumo', i.nombre,
        'lote_mp', sl.lote,
        'cantidad', sm.cantidad,
        'unidad', i.unidad_medida,
        'origen', sm.origen,
        'observaciones', sm.observaciones,
        'fecha', sm.created_at
      )
      order by sm.created_at
    ) filter (where sm.id is not null) as mp_movimientos
  from public.stock_movimientos sm
  join public.stock_lotes_mp sl
    on sl.id = sm.lote_id
   and sl.deleted_at is null
  join public.insumos i
    on i.id = sl.insumo_id
  where nullif(sm.metadata->>'orden_id', '')::uuid = op.id
) mp_mov on true
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'stock_pt_id', pt.id,
        'lote_pt', pt.lote,
        'cantidad', pt.cantidad_total,
        'unidad', pt.unidad_medida,
        'silo', pt.nombre_silo,
        'fecha', pt.fecha_ingreso
      )
      order by pt.fecha_ingreso
    ) filter (where pt.id is not null) as pt_generado
  from public.stock_pt pt
  where pt.orden_id = op.id
    and pt.deleted_at is null
) ptg on true
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'tipo', ptm.tipo,
        'cantidad', ptm.cantidad,
        'motivo', ptm.motivo,
        'referencia', ptm.referencia,
        'fecha', ptm.created_at
      )
      order by ptm.created_at
    ) filter (where ptm.id is not null) as salidas_pt
  from public.stock_pt pt
  left join public.stock_pt_movimientos ptm
    on ptm.stock_pt_id = pt.id
   and ptm.tipo = 'SALIDA'
  where pt.orden_id = op.id
    and pt.deleted_at is null
) pts on true
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'tipo', te.tipo,
        'referencia', te.referencia,
        'fecha', te.fecha_evento,
        'payload', te.payload
      )
      order by te.fecha_evento
    ) filter (where te.id is not null) as eventos
  from public.trazabilidad_eventos te
  where te.orden_id = op.id
) ev on true;
