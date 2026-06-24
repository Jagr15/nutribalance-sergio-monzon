-- Seed idempotente de stock QA alto para pruebas.
-- Normaliza lotes `qa-stock-%` para todos los insumos activos sin tocar lotes reales.

do $$
declare
  v_proveedor_id uuid;
  v_usuario_id uuid;
begin
  select p.id
  into v_proveedor_id
  from public.proveedores p
  where p.deleted_at is null
    and p.esta_activo = true
  order by p.created_at asc, p.id asc
  limit 1;

  if v_proveedor_id is null then
    raise exception 'No hay proveedor activo disponible para seed de stock QA';
  end if;

  select u.id
  into v_usuario_id
  from public.usuarios u
  where u.deleted_at is null
    and u.esta_activo = true
  order by u.created_at asc, u.id asc
  limit 1;

  if v_usuario_id is null then
    raise exception 'No hay usuario activo disponible para seed de stock QA';
  end if;

  with insumos_activos as (
    select
      i.id as insumo_id,
      i.legacy_uid as insumo_legacy_uid,
      i.nombre as insumo_nombre,
      coalesce(nullif(trim(i.unidad_medida), ''), 'KG') as unidad_medida,
      coalesce(i.ref_costo_unitario, 1)::numeric as costo_unitario
    from public.insumos i
    where i.deleted_at is null
      and i.esta_activo = true
  ), lotes_qa as (
    select
      ia.insumo_id,
      ('qa-stock-' || ia.insumo_legacy_uid) as legacy_uid,
      ('QA STOCK ' || upper(replace(ia.insumo_nombre, ' ', '_'))) as lote,
      ('QA-REM-' || ia.insumo_legacy_uid) as remito_nro,
      ('Depósito QA ' || ia.unidad_medida) as ubicacion,
      100000::numeric as cantidad_inicial,
      100000::numeric as cantidad_actual,
      0::numeric as cantidad_comprometida,
      ia.costo_unitario as costo_unitario,
      (100000::numeric * ia.costo_unitario)::numeric as costo_total,
      now() as fecha_ingreso
    from insumos_activos ia
  )
  insert into public.stock_lotes_mp (
    legacy_uid,
    insumo_id,
    proveedor_id,
    lote,
    remito_nro,
    ubicacion,
    cantidad_inicial,
    cantidad_actual,
    cantidad_comprometida,
    costo_unitario,
    costo_total,
    fecha_ingreso,
    id_usuario,
    created_at,
    updated_at
  )
  select
    lq.legacy_uid,
    lq.insumo_id,
    v_proveedor_id,
    lq.lote,
    lq.remito_nro,
    lq.ubicacion,
    lq.cantidad_inicial,
    lq.cantidad_actual,
    lq.cantidad_comprometida,
    lq.costo_unitario,
    lq.costo_total,
    lq.fecha_ingreso,
    v_usuario_id,
    now(),
    now()
  from lotes_qa lq
  on conflict (legacy_uid) do update set
    insumo_id = excluded.insumo_id,
    proveedor_id = excluded.proveedor_id,
    lote = excluded.lote,
    remito_nro = excluded.remito_nro,
    ubicacion = excluded.ubicacion,
    cantidad_inicial = excluded.cantidad_inicial,
    cantidad_actual = excluded.cantidad_actual,
    cantidad_comprometida = excluded.cantidad_comprometida,
    costo_unitario = excluded.costo_unitario,
    costo_total = excluded.costo_total,
    fecha_ingreso = excluded.fecha_ingreso,
    id_usuario = excluded.id_usuario,
    updated_at = now();
end;
$$;
