create or replace view public.stock_mp_resumen as
select
  i.legacy_uid as insumo_id,
  i.nombre as nombre_insumo,
  i.unidad_medida as unidad,
  coalesce(sum(sl.cantidad_actual), 0)::numeric(14,3) as stock_actual,
  coalesce(sum(sl.cantidad_comprometida), 0)::numeric(14,3) as stock_comprometido,
  coalesce(sum(sl.cantidad_actual - sl.cantidad_comprometida), 0)::numeric(14,3) as stock_disponible,
  coalesce(i.umbral_alerta, 0)::numeric(14,3) as umbral_alerta,
  case
    when coalesce(sum(sl.cantidad_actual - sl.cantidad_comprometida), 0) <= coalesce(i.umbral_alerta, 0) then 'CRITICO'
    when coalesce(sum(sl.cantidad_actual - sl.cantidad_comprometida), 0) <= coalesce(i.umbral_alerta, 0) * 2 then 'BAJO'
    else 'OK'
  end as estado
from public.insumos i
left join public.stock_lotes_mp sl
  on sl.insumo_id = i.id
  and sl.deleted_at is null
where i.deleted_at is null
group by i.id, i.legacy_uid, i.nombre, i.unidad_medida, i.umbral_alerta;
