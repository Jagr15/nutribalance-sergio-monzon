-- FASE 3.5: Finalización transaccional de producción
create or replace function public.finalizar_orden_produccion(
  p_orden_id uuid,
  p_cantidad_real numeric,
  p_merma_manual numeric,
  p_destino_silo text,
  p_lote_salida text
)
returns table (
  id uuid,
  legacy_uid text,
  lote text,
  id_formula_legacy text,
  nombre_producto text,
  version_formula integer,
  cantidad_objetivo numeric,
  cantidad_real numeric,
  merma_manual numeric,
  id_silo_legacy text,
  destino_silo text,
  estado text,
  fecha_creacion timestamptz,
  usuario_responsable text,
  costo_total_insumos numeric
)
language plpgsql
as $$
declare
  v_orden public.ordenes_produccion%rowtype;
  v_silo public.silos%rowtype;
  v_stock_pt_id uuid;
  v_consumo_count integer;
  v_detalle jsonb;
  v_item record;
  v_lote_id uuid;
  v_disponible numeric;
begin
  if p_cantidad_real is null or p_cantidad_real <= 0 then
    raise exception 'La cantidad real debe ser mayor a cero.';
  end if;

  if p_destino_silo is null or btrim(p_destino_silo) = '' then
    raise exception 'Debe indicar el silo de destino.';
  end if;

  if p_lote_salida is null or btrim(p_lote_salida) = '' then
    raise exception 'Debe indicar el lote de salida de producto terminado.';
  end if;

  select *
  into v_orden
  from public.ordenes_produccion op
  where op.id = p_orden_id
    and op.deleted_at is null
  for update;

  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  if v_orden.estado = 'FINALIZADO' then
    raise exception 'La orden ya se encuentra finalizada.';
  end if;

  if v_orden.estado = 'ANULADO' then
    raise exception 'No se puede finalizar una orden anulada.';
  end if;

  if v_orden.estado <> 'EN PROCESO' then
    raise exception 'Solo se puede finalizar una orden EN PROCESO.';
  end if;

  if exists (
    select 1
    from public.stock_pt pt
    where pt.orden_id = v_orden.id
      and pt.deleted_at is null
  ) then
    raise exception 'La orden ya se encuentra finalizada.';
  end if;

  select *
  into v_silo
  from public.silos
  where nombre = p_destino_silo
    and deleted_at is null
  limit 1;

  if not found then
    raise exception 'Silo de destino inválido.';
  end if;

  select count(*) into v_consumo_count
  from public.orden_consumo_lotes ocl
  where ocl.orden_id = v_orden.id;

  if v_consumo_count = 0 then
    raise exception 'La orden no tiene consumo planificado.';
  end if;

  for v_item in
    select
      ocl.id_lote_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(
        ocl.lote_id,
        sl_legacy.id,
        sl_nombre.id
      ) as lote_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.stock_lotes_mp sl_legacy
      on sl_legacy.legacy_uid = ocl.id_lote_legacy
      and sl_legacy.deleted_at is null
    left join public.stock_lotes_mp sl_nombre
      on sl_nombre.lote = ocl.id_lote_legacy
      and sl_nombre.deleted_at is null
    where ocl.orden_id = v_orden.id
  loop
    if v_item.cantidad_usada <= 0 then
      raise exception 'Cantidad inválida para %.', v_item.nombre_insumo;
    end if;

    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;

    select (sl.cantidad_actual - sl.cantidad_comprometida)
    into v_disponible
    from public.stock_lotes_mp sl
    where sl.id = v_lote_id
      and sl.deleted_at is null
    for update;

    if v_disponible is null or v_disponible + 0.0001 < v_item.cantidad_usada then
      raise exception 'Stock insuficiente para % en lote %.', v_item.nombre_insumo, v_item.id_lote_legacy;
    end if;

    insert into public.stock_movimientos (
      lote_id,
      tipo,
      origen,
      cantidad,
      observaciones,
      metadata
    ) values (
      v_lote_id,
      'SALIDA',
      'PRODUCCION',
      v_item.cantidad_usada,
      format('Consumo OP %s - %s', coalesce(v_orden.legacy_uid, v_orden.lote), v_item.nombre_insumo),
      jsonb_build_object(
        'orden_id', v_orden.id,
        'orden_legacy_uid', v_orden.legacy_uid,
        'lote_mp_legacy_uid', v_item.id_lote_legacy,
        'nombre_insumo', v_item.nombre_insumo
      )
    );

    update public.stock_lotes_mp sl
    set cantidad_comprometida = greatest(0, sl.cantidad_comprometida - v_item.cantidad_usada)
    where sl.id = v_lote_id;
  end loop;

  update public.ordenes_produccion op
  set
    estado = 'FINALIZADO',
    cantidad_real = p_cantidad_real,
    merma_manual = p_merma_manual,
    destino_silo = p_destino_silo,
    silo_id = v_silo.id,
    id_silo_legacy = v_silo.legacy_uid
  where op.id = v_orden.id;

  select jsonb_agg(
    jsonb_build_object(
      'id_lote', ocl.id_lote_legacy,
      'id_insumo', ocl.id_insumo_legacy,
      'nombre_insumo', ocl.nombre_insumo,
      'cantidad_usada', ocl.cantidad_usada,
      'tipo_unidad', ocl.tipo_unidad,
      'costo_unitario', ocl.costo_unitario,
      'costo_total', ocl.costo_total
    )
  ) into v_detalle
  from public.orden_consumo_lotes ocl
  where ocl.orden_id = v_orden.id;

  insert into public.stock_pt (
    legacy_uid,
    orden_id,
    id_orden_legacy,
    numero_orden,
    nombre_producto,
    cantidad_total,
    lote,
    unidad_medida,
    estado,
    silo_id,
    id_silo_legacy,
    nombre_silo,
    detalle_insumos,
    usuario
  ) values (
    'pt-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    v_orden.legacy_uid,
    v_orden.legacy_uid,
    v_orden.nombre_producto,
    p_cantidad_real,
    p_lote_salida,
    'KG',
    'OK',
    v_silo.id,
    v_silo.legacy_uid,
    v_silo.nombre,
    coalesce(v_detalle, '[]'::jsonb),
    v_orden.usuario_responsable
  )
  returning stock_pt.id into v_stock_pt_id;

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    'CONSUMO_MP',
    format('Consumo MP OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object('consumos', coalesce(v_detalle, '[]'::jsonb)),
    v_orden.usuario_id
  );

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    stock_pt_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    v_stock_pt_id,
    'PRODUCCION_FIN',
    format('Finalización OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object(
      'cantidad_real', p_cantidad_real,
      'merma_manual', p_merma_manual,
      'destino_silo', p_destino_silo,
      'lote_salida', p_lote_salida
    ),
    v_orden.usuario_id
  );

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    stock_pt_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    v_stock_pt_id,
    'INGRESO_PT',
    format('Ingreso PT %s', p_lote_salida),
    jsonb_build_object(
      'lote', p_lote_salida,
      'cantidad_total', p_cantidad_real,
      'silo', p_destino_silo
    ),
    v_orden.usuario_id
  );

  return query
  select
    op.id,
    op.legacy_uid,
    op.lote,
    op.id_formula_legacy,
    op.nombre_producto,
    op.version_formula,
    op.cantidad_objetivo,
    op.cantidad_real,
    op.merma_manual,
    op.id_silo_legacy,
    op.destino_silo,
    op.estado,
    op.fecha_creacion,
    op.usuario_responsable,
    op.costo_total_insumos
  from public.ordenes_produccion op
  where op.id = v_orden.id;
end;
$$;
