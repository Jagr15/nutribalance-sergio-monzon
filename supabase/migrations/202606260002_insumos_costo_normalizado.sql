alter table public.insumos
  add column if not exists costo numeric(14,6),
  add column if not exists unidad_costo text;

update public.insumos
set
  costo = coalesce(costo, ref_costo_unitario),
  unidad_costo = coalesce(unidad_costo, 'KG'),
  costo_por_kg = coalesce(costo_por_kg, ref_costo_unitario, costo),
  costo_por_tonelada = coalesce(costo_por_tonelada, coalesce(costo_por_kg, ref_costo_unitario, costo) * 1000)
where deleted_at is null;

alter table public.insumos
  add constraint insumos_unidad_costo_check check (unidad_costo is null or unidad_costo in ('KG', 'TON'));

