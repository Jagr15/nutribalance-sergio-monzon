-- Propuesta de evolución: presupuesto mensual editable por rubro
-- Esta migración conserva compatibilidad con la tabla existente y agrega
-- una entidad más explícita para la gestión mensual.

alter table if exists public.presupuestos_mensuales
  add column if not exists rubro_id uuid references public.categorias_financieras(id);

update public.presupuestos_mensuales
set rubro_id = coalesce(rubro_id, categoria_id)
where rubro_id is null and categoria_id is not null;

create index if not exists idx_presupuestos_mensuales_rubro_periodo
  on public.presupuestos_mensuales(rubro_id, anio, mes);

create unique index if not exists idx_presupuestos_mensuales_rubro_periodo_unique
  on public.presupuestos_mensuales(rubro_id, anio, mes)
  where deleted_at is null;

