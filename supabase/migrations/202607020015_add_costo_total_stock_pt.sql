alter table public.stock_pt
  add column if not exists costo_total numeric(14,6);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_pt_costo_total_non_negative'
  ) then
    alter table public.stock_pt
      add constraint stock_pt_costo_total_non_negative
      check (costo_total is null or costo_total >= 0);
  end if;
end;
$$;

update public.stock_pt
set costo_total = round(coalesce(cantidad_total, 0) * coalesce(costo_unitario_estimado, 0), 6)
where costo_total is null;

create or replace function public.sync_stock_pt_costo_total()
returns trigger
language plpgsql
as $$
begin
  new.costo_total := round(coalesce(new.cantidad_total, 0) * coalesce(new.costo_unitario_estimado, 0), 6);
  return new;
end;
$$;

drop trigger if exists trg_sync_stock_pt_costo_total on public.stock_pt;

create trigger trg_sync_stock_pt_costo_total
before insert or update of cantidad_total, costo_unitario_estimado
on public.stock_pt
for each row
execute function public.sync_stock_pt_costo_total();

create or replace view public.stock_pt_resumen as
with base as (
  select
    pt.id as stock_pt_id,
    coalesce(pt.id_formula_legacy, op.id_formula_legacy, pt.nombre_producto) as producto_id,
    pt.nombre_producto,
    pt.unidad_medida as unidad,
    pt.cantidad_total,
    coalesce(pt.cantidad_inicial, pt.cantidad_total) as cantidad_inicial,
    coalesce(
      pt.costo_unitario_estimado,
      case
        when pt.cantidad_total > 0 and coalesce(op.costo_total_insumos, 0) > 0
          then op.costo_total_insumos / nullif(pt.cantidad_total, 0)
        else 0
      end
    ) as costo_unitario_estimado,
    coalesce(
      pt.costo_total,
      round(
        coalesce(pt.cantidad_total, 0) * coalesce(
          pt.costo_unitario_estimado,
          case
            when pt.cantidad_total > 0 and coalesce(op.costo_total_insumos, 0) > 0
              then op.costo_total_insumos / nullif(pt.cantidad_total, 0)
            else 0
          end
        ),
        6
      )
    ) as costo_total,
    pt.estado,
    pt.updated_at,
    pt.fecha_ingreso,
    pt.numero_orden,
    pt.id_formula_legacy,
    pt.version_formula
  from public.stock_pt pt
  left join public.ordenes_produccion op
    on op.id = pt.orden_id
  where pt.deleted_at is null
)
select
  producto_id,
  nombre_producto,
  unidad,
  coalesce(sum(cantidad_total), 0)::numeric(14,3) as stock_actual,
  coalesce(sum(costo_total), 0)::numeric(14,6) as valor_monetario,
  case
    when coalesce(sum(cantidad_inicial), 0) <= 0 then 'OK'
    when coalesce(sum(cantidad_total), 0) / nullif(coalesce(sum(cantidad_inicial), 0), 0) <= 0.2 then 'CRITICO'
    when coalesce(sum(cantidad_total), 0) / nullif(coalesce(sum(cantidad_inicial), 0), 0) <= 0.4 then 'BAJO'
    else 'OK'
  end as estado,
  count(*)::integer as cantidad_lotes,
  max(greatest(coalesce(updated_at, fecha_ingreso), fecha_ingreso)) as ultima_actualizacion,
  (array_agg(numero_orden order by coalesce(updated_at, fecha_ingreso) desc))[1] as numero_orden,
  (array_agg(id_formula_legacy order by coalesce(updated_at, fecha_ingreso) desc))[1] as id_formula,
  (array_agg(version_formula order by coalesce(updated_at, fecha_ingreso) desc))[1] as version_formula
from base
group by producto_id, nombre_producto, unidad;
