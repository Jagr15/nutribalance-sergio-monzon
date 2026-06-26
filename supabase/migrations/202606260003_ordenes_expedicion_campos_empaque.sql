alter table public.ordenes_expedicion
  add column if not exists cantidad_original numeric(14,3),
  add column if not exists unidad_original text,
  add column if not exists cantidad_kg numeric(14,3),
  add column if not exists modo_calculo text,
  add column if not exists empaque_id uuid,
  add column if not exists tipo_empaque text,
  add column if not exists capacidad_empaque_kg numeric(14,3),
  add column if not exists cantidad_empaques numeric(14,3),
  add column if not exists sobrante_kg numeric(14,3),
  add column if not exists unidad_cantidad text;

update public.ordenes_expedicion
set
  cantidad_original = coalesce(cantidad_original, cantidad),
  unidad_original = coalesce(unidad_original, 'kg'),
  cantidad_kg = coalesce(cantidad_kg, cantidad),
  modo_calculo = coalesce(modo_calculo, 'kg_requeridos'),
  capacidad_empaque_kg = coalesce(capacidad_empaque_kg, 1),
  cantidad_empaques = coalesce(cantidad_empaques, cantidad),
  sobrante_kg = coalesce(sobrante_kg, 0),
  unidad_cantidad = coalesce(unidad_cantidad, 'kg')
where true;

alter table public.ordenes_expedicion
  alter column cantidad_original set default 0,
  alter column unidad_original set default 'kg',
  alter column cantidad_kg set default 0,
  alter column modo_calculo set default 'kg_requeridos',
  alter column capacidad_empaque_kg set default 1,
  alter column cantidad_empaques set default 0,
  alter column sobrante_kg set default 0,
  alter column unidad_cantidad set default 'kg';

update public.ordenes_expedicion
set
  cantidad_original = coalesce(cantidad_original, 0),
  unidad_original = coalesce(unidad_original, 'kg'),
  cantidad_kg = coalesce(cantidad_kg, 0),
  modo_calculo = coalesce(modo_calculo, 'kg_requeridos'),
  capacidad_empaque_kg = coalesce(capacidad_empaque_kg, 1),
  cantidad_empaques = coalesce(cantidad_empaques, 0),
  sobrante_kg = coalesce(sobrante_kg, 0),
  unidad_cantidad = coalesce(unidad_cantidad, 'kg');
