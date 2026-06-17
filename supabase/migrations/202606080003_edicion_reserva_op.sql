-- Edición segura de OP reservadas
-- Libera la reserva anterior, recalcula el detalle FIFO y reserva la nueva versión de forma atómica.

create or replace function public.actualizar_orden_produccion_con_reserva(
  p_orden_id uuid,
  p_legacy_uid text,
  p_lote text,
  p_formula_id uuid,
  p_id_formula_legacy text,
  p_nombre_producto text,
  p_version_formula integer,
  p_cantidad_objetivo numeric,
  p_cantidad_real numeric,
  p_merma_manual numeric,
  p_silo_id uuid,
  p_id_silo_legacy text,
  p_destino_silo text,
  p_fecha_creacion timestamptz,
  p_usuario_responsable text,
  p_usuario_id uuid,
  p_costo_total_insumos numeric,
  p_detalle jsonb
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
  v_item record;
  v_lote_id uuid;
  v_disponible numeric;
  v_consumo_count integer;
begin
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
    raise exception 'No se puede editar una orden finalizada.';
  end if;

  if v_orden.estado = 'ANULADO' then
    raise exception 'No se puede editar una orden anulada.';
  end if;

  if p_detalle is null or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La orden no tiene consumo planificado.';
  end if;

  -- Liberar reserva anterior antes de recalcular la nueva versión.
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
    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;

    update public.stock_lotes_mp sl
    set cantidad_comprometida = greatest(0, sl.cantidad_comprometida - v_item.cantidad_usada)
    where sl.id = v_lote_id;
  end loop;

  delete from public.orden_consumo_lotes
  where orden_id = v_orden.id;

  insert into public.orden_consumo_lotes (
    orden_id,
    lote_id,
    id_lote_legacy,
    insumo_id,
    id_insumo_legacy,
    nombre_insumo,
    cantidad_usada,
    tipo_unidad,
    costo_unitario,
    costo_total
  )
  select
    v_orden.id,
    d.lote_id,
    d.id_lote,
    d.insumo_id,
    d.id_insumo,
    d.nombre_insumo,
    d.cantidad_usada,
    d.tipo_unidad,
    d.costo_unitario,
    d.costo_total
  from jsonb_to_recordset(p_detalle) as d(
    id_lote text,
    id_insumo text,
    nombre_insumo text,
    cantidad_usada numeric,
    tipo_unidad text,
    costo_unitario numeric,
    costo_total numeric,
    lote_id uuid,
    insumo_id uuid
  );

  select count(*) into v_consumo_count
  from public.orden_consumo_lotes
  where orden_id = v_orden.id;

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

    update public.stock_lotes_mp sl
    set cantidad_comprometida = sl.cantidad_comprometida + v_item.cantidad_usada
    where sl.id = v_lote_id;
  end loop;

  update public.ordenes_produccion op
  set
    legacy_uid = p_legacy_uid,
    lote = p_lote,
    formula_id = p_formula_id,
    id_formula_legacy = p_id_formula_legacy,
    nombre_producto = p_nombre_producto,
    version_formula = p_version_formula,
    cantidad_objetivo = p_cantidad_objetivo,
    cantidad_real = p_cantidad_real,
    merma_manual = p_merma_manual,
    silo_id = p_silo_id,
    id_silo_legacy = p_id_silo_legacy,
    destino_silo = p_destino_silo,
    fecha_creacion = p_fecha_creacion,
    usuario_responsable = p_usuario_responsable,
    usuario_id = p_usuario_id,
    costo_total_insumos = p_costo_total_insumos
  where op.id = v_orden.id;

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
    'RESERVA_MP',
    format('Edición de reserva OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object(
      'accion', 'EDICION_RESERVA',
      'orden_id', v_orden.id,
      'orden_legacy_uid', v_orden.legacy_uid,
      'detalle', p_detalle
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
