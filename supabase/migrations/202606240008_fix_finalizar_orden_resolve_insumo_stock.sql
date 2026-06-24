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
  v_lote record;
  v_insumo_db_id uuid;
  v_lote_id uuid;
  v_consumo_real numeric;
  v_factor numeric;
  v_disponible numeric;
  v_a_consumir numeric;
  v_consumido_lote numeric;
  v_costo_unitario numeric;
  v_insumo_legacy_normalized text;
  v_insumo_nombre_normalized text;
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

  select op.*
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

  select s.*
  into v_silo
  from public.silos s
  where s.nombre = p_destino_silo
    and s.deleted_at is null
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

  if v_orden.cantidad_objetivo is null or v_orden.cantidad_objetivo <= 0 then
    raise exception 'La cantidad objetivo de la orden es inválida.';
  end if;

  v_factor := p_cantidad_real / v_orden.cantidad_objetivo;
  v_costo_unitario := round(coalesce(v_orden.costo_total_insumos, 0) / nullif(p_cantidad_real, 0), 6);

  for v_item in
    select
      ocl.id,
      ocl.id_lote_legacy,
      ocl.insumo_id,
      ocl.id_insumo_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(ocl.insumo_id, ins_legacy.id, ins_nombre.id) as insumo_db_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.insumos ins_legacy
      on ins_legacy.legacy_uid = ocl.id_insumo_legacy
      and ins_legacy.deleted_at is null
      and ins_legacy.esta_activo = true
    left join public.insumos ins_nombre
      on regexp_replace(lower(btrim(ins_nombre.nombre)), '[^a-z0-9]+', '', 'g')
         = regexp_replace(lower(btrim(ocl.nombre_insumo)), '[^a-z0-9]+', '', 'g')
      and ins_nombre.deleted_at is null
      and ins_nombre.esta_activo = true
    where ocl.orden_id = v_orden.id
    order by ocl.id asc
  loop
    if v_item.cantidad_usada <= 0 then
      raise exception 'Cantidad inválida para %.', v_item.nombre_insumo;
    end if;

    v_consumo_real := round(v_item.cantidad_usada * v_factor, 3);
    if v_consumo_real <= 0 then
      raise exception 'El consumo real calculado para % es inválido.', v_item.nombre_insumo;
    end if;

    v_insumo_db_id := v_item.insumo_db_id_resuelto;
    if v_insumo_db_id is null then
      raise exception 'No se pudo resolver el insumo % para la orden %.', v_item.nombre_insumo, v_orden.legacy_uid;
    end if;

    v_a_consumir := v_consumo_real;

    for v_lote in
      select
        sl.id,
        sl.legacy_uid,
        sl.lote,
        sl.cantidad_actual,
        sl.cantidad_comprometida,
        sl.costo_unitario
      from public.stock_lotes_mp sl
      where sl.deleted_at is null
        and sl.insumo_id = v_insumo_db_id
        and coalesce(sl.cantidad_actual, 0) > 0
      order by sl.fecha_ingreso asc, sl.created_at asc, sl.id asc
      for update of sl
    loop
      exit when v_a_consumir <= 0;

      v_disponible := round(greatest(0, v_lote.cantidad_actual - coalesce(v_lote.cantidad_comprometida, 0)), 3);
      if v_disponible <= 0 then
        continue;
      end if;

      v_lote_id := v_lote.id;
      v_consumido_lote := least(v_a_consumir, v_disponible);

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
        v_consumido_lote,
        format('Consumo OP %s - %s', coalesce(v_orden.legacy_uid, v_orden.lote), v_item.nombre_insumo),
        jsonb_build_object(
          'orden_id', v_orden.id,
          'orden_legacy_uid', v_orden.legacy_uid,
          'lote_mp_legacy_uid', coalesce(v_lote.legacy_uid, v_lote.lote),
          'insumo_id', v_insumo_db_id,
          'nombre_insumo', v_item.nombre_insumo,
          'cantidad_planificada', v_item.cantidad_usada,
          'cantidad_real', v_consumido_lote,
          'factor_aplicado', v_factor
        )
      );

      update public.stock_lotes_mp sl_upd
      set cantidad_actual = greatest(0, coalesce(sl_upd.cantidad_actual, 0) - v_consumido_lote),
          cantidad_comprometida = greatest(0, coalesce(sl_upd.cantidad_comprometida, 0) - v_consumido_lote)
      where sl_upd.id = v_lote_id;

      v_a_consumir := round(v_a_consumir - v_consumido_lote, 3);
    end loop;

    if v_a_consumir > 0.0005 then
      raise exception 'Stock insuficiente para %.', v_item.nombre_insumo;
    end if;
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
    cantidad_inicial,
    costo_unitario_estimado,
    id_formula_legacy,
    version_formula,
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
    p_cantidad_real,
    v_costo_unitario,
    v_orden.id_formula_legacy,
    v_orden.version_formula,
    p_lote_salida,
    coalesce(v_orden.unidad_medida, 'KG'),
    'OK',
    v_silo.id,
    v_silo.legacy_uid,
    v_silo.nombre,
    coalesce(v_detalle, '[]'::jsonb),
    v_orden.usuario_responsable
  )
  returning id into v_stock_pt_id;

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
