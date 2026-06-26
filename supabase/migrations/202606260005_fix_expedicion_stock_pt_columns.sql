create or replace function public.registrar_orden_expedicion(
  p_stock_pt_id uuid,
  p_cliente_id uuid,
  p_presentacion text,
  p_cantidad numeric,
  p_cantidad_original numeric default null,
  p_unidad_cantidad text default null,
  p_modo_calculo text default null,
  p_empaque_id uuid default null,
  p_tipo_empaque text default null,
  p_capacidad_empaque_kg numeric default null,
  p_cantidad_empaques numeric default null,
  p_sobrante_kg numeric default null,
  p_motivo text default null,
  p_referencia text default null
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_stock_pt public.stock_pt%rowtype;
  v_numero_expedicion text;
  v_legacy_uid text;
  v_presentacion text := upper(trim(coalesce(p_presentacion, '')));
  v_unidad text := lower(trim(coalesce(p_unidad_cantidad, 'kg')));
  v_cantidad_kg numeric;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad a expedir debe ser mayor a cero.';
  end if;
  if p_cantidad_original is null or p_cantidad_original <= 0 then
    raise exception 'La cantidad original debe ser mayor a cero.';
  end if;
  if v_unidad not in ('kg', 'tonelada') then
    raise exception 'La unidad de medida no es válida.';
  end if;
  if p_cliente_id is null then
    raise exception 'El cliente destino es obligatorio.';
  end if;
  if v_presentacion not in ('GRANEL', 'BIG_BAG', 'BOLSA') then
    raise exception 'La presentación seleccionada no es válida.';
  end if;

  v_cantidad_kg := round(p_cantidad_original * case when v_unidad = 'tonelada' then 1000 else 1 end, 3);

  select *
  into v_stock_pt
  from public.stock_pt pt
  where pt.id = p_stock_pt_id
    and pt.deleted_at is null
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  if (v_stock_pt.cantidad_total - coalesce(v_stock_pt.cantidad_comprometida, 0)) < v_cantidad_kg then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  update public.stock_pt
  set cantidad_comprometida = coalesce(cantidad_comprometida, 0) + v_cantidad_kg,
      updated_at = now()
  where id = v_stock_pt.id;

  v_numero_expedicion := format('EXP-%s-%06s', to_char(now(), 'YYYY'), nextval('public.ordenes_expedicion_numero_seq'));
  v_legacy_uid := 'exp-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.ordenes_expedicion (
    legacy_uid, numero_expedicion, stock_pt_id, producto_id, nombre_producto, lote_pt,
    cliente_id, presentacion, cantidad, cantidad_original, unidad_original, unidad_cantidad, cantidad_kg,
    modo_calculo, empaque_id, tipo_empaque, capacidad_empaque_kg, cantidad_empaques, sobrante_kg,
    estado, motivo, referencia
  ) values (
    v_legacy_uid, v_numero_expedicion, v_stock_pt.id,
    coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, p_cliente_id, v_presentacion, p_cantidad,
    p_cantidad_original, v_unidad, v_unidad, v_cantidad_kg,
    coalesce(p_modo_calculo, 'kg_requeridos'), p_empaque_id, p_tipo_empaque,
    coalesce(p_capacidad_empaque_kg, 1), coalesce(p_cantidad_empaques, p_cantidad_original), coalesce(p_sobrante_kg, 0),
    'pendiente',
    coalesce(p_motivo, 'Despacho de producto terminado'),
    coalesce(p_referencia, v_numero_expedicion)
  );

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'AJUSTE', v_cantidad_kg, v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado, 0,
    'Reserva de stock para orden de expedición', v_numero_expedicion, p_cliente_id
  );

  insert into public.trazabilidad_eventos (
    legacy_uid, orden_id, stock_pt_id, tipo, referencia, payload, usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''), v_stock_pt.orden_id, v_stock_pt.id, 'RESERVA_PT', v_numero_expedicion,
    jsonb_build_object('cantidad_kg', v_cantidad_kg, 'cantidad_original', p_cantidad_original, 'unidad', v_unidad, 'estado', 'pendiente'),
    null
  );

  return query select * from public.ordenes_expedicion where legacy_uid = v_legacy_uid;
end;
$$;

create or replace function public.actualizar_orden_expedicion(
  p_orden_id uuid,
  p_presentacion text default null,
  p_cantidad numeric default null,
  p_cantidad_original numeric default null,
  p_unidad_cantidad text default null,
  p_motivo text default null,
  p_referencia text default null
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_unidad text;
  v_nueva_cantidad_kg numeric;
  v_delta numeric;
begin
  select * into v_orden from public.ordenes_expedicion where id = p_orden_id for update;
  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'Solo se puede editar una orden pendiente.';
  end if;

  v_unidad := lower(trim(coalesce(p_unidad_cantidad, v_orden.unidad_cantidad)));
  if v_unidad not in ('kg', 'tonelada') then
    raise exception 'La unidad de medida no es válida.';
  end if;
  if coalesce(p_cantidad, v_orden.cantidad_original) <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  v_nueva_cantidad_kg := round(coalesce(p_cantidad_original, v_orden.cantidad_original) * case when v_unidad = 'tonelada' then 1000 else 1 end, 3);
  v_delta := v_nueva_cantidad_kg - v_orden.cantidad_kg;

  select * into v_stock_pt from public.stock_pt where id = v_orden.stock_pt_id for update;
  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  if v_delta > 0 and (v_stock_pt.cantidad_total - coalesce(v_stock_pt.cantidad_comprometida, 0)) < v_delta then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  update public.stock_pt
  set cantidad_comprometida = greatest(0, coalesce(cantidad_comprometida, 0) + v_delta),
      updated_at = now()
  where id = v_stock_pt.id;

  update public.ordenes_expedicion set
    presentacion = coalesce(p_presentacion, presentacion),
    cantidad = coalesce(p_cantidad, cantidad),
    cantidad_original = coalesce(p_cantidad_original, cantidad_original),
    unidad_original = coalesce(p_unidad_cantidad, unidad_original),
    unidad_cantidad = v_unidad,
    cantidad_kg = v_nueva_cantidad_kg,
    modo_calculo = coalesce(modo_calculo, 'kg_requeridos'),
    motivo = coalesce(p_motivo, motivo),
    referencia = coalesce(p_referencia, referencia),
    updated_at = now()
  where id = p_orden_id;

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'AJUSTE', abs(v_delta), v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado, 0,
    case when v_delta >= 0 then 'Ajuste al alza de reserva' else 'Ajuste a la baja de reserva' end,
    coalesce(p_referencia, v_orden.numero_expedicion), v_orden.cliente_id
  );

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;

create or replace function public.despachar_orden_expedicion(
  p_orden_id uuid
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_saldo_inicial numeric;
  v_estado text;
begin
  select * into v_orden from public.ordenes_expedicion where id = p_orden_id for update;
  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;
  if v_orden.estado = 'despachada' then
    return query select * from public.ordenes_expedicion where id = p_orden_id;
  end if;
  if v_orden.estado <> 'lista' then
    raise exception 'La orden debe estar en estado lista para despachar.';
  end if;

  select * into v_stock_pt from public.stock_pt where id = v_orden.stock_pt_id for update;
  if not found then
    raise exception 'El stock PT no existe.';
  end if;
  if coalesce(v_stock_pt.cantidad_comprometida, 0) < v_orden.cantidad_kg then
    raise exception 'La reserva comprometida no coincide con la orden.';
  end if;
  if v_stock_pt.cantidad_total < v_orden.cantidad_kg then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  v_saldo_inicial := coalesce(v_stock_pt.cantidad_inicial, v_stock_pt.cantidad_total);
  v_estado := public.calcular_estado_stock_pt(v_stock_pt.cantidad_total - v_orden.cantidad_kg, v_saldo_inicial);

  update public.stock_pt
  set cantidad_total = cantidad_total - v_orden.cantidad_kg,
      cantidad_comprometida = greatest(0, coalesce(cantidad_comprometida, 0) - v_orden.cantidad_kg),
      estado = v_estado,
      updated_at = now()
  where id = v_stock_pt.id;

  update public.ordenes_expedicion
  set estado = 'despachada', updated_at = now()
  where id = v_orden.id
    and estado <> 'despachada';

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'SALIDA', v_orden.cantidad_kg, v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado,
    round(v_orden.cantidad_kg * coalesce(v_stock_pt.costo_unitario_estimado, 0), 6),
    coalesce(v_orden.motivo, 'Salida de producto terminado'),
    v_orden.numero_expedicion,
    v_orden.cliente_id
  );

  insert into public.trazabilidad_eventos (
    legacy_uid, orden_id, stock_pt_id, tipo, referencia, payload, usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    null, v_stock_pt.id, 'DESPACHO_PT', v_orden.numero_expedicion,
    jsonb_build_object('cantidad_kg', v_orden.cantidad_kg, 'estado', 'despachada'),
    null
  );

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;

create or replace function public.cancelar_orden_expedicion(
  p_orden_id uuid
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_tipo_evento text;
begin
  select * into v_orden from public.ordenes_expedicion where id = p_orden_id for update;
  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;
  if v_orden.estado = 'cancelada' then
    return query select * from public.ordenes_expedicion where id = p_orden_id;
  end if;
  if v_orden.estado not in ('pendiente', 'preparando', 'lista') then
    raise exception 'No se puede cancelar una orden ya despachada.';
  end if;

  select * into v_stock_pt from public.stock_pt where id = v_orden.stock_pt_id for update;
  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  update public.stock_pt
  set cantidad_comprometida = greatest(0, coalesce(cantidad_comprometida, 0) - v_orden.cantidad_kg),
      updated_at = now()
  where id = v_stock_pt.id;

  v_tipo_evento := case when v_orden.estado = 'lista' then 'CANCELACION_EXPEDICION' else 'LIBERACION_RESERVA_PT' end;

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'AJUSTE', v_orden.cantidad_kg, v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado, 0,
    case when v_orden.estado = 'lista' then 'Cancelación de expedición' else 'Liberación de reserva por cancelación' end,
    v_orden.numero_expedicion, v_orden.cliente_id
  );

  update public.ordenes_expedicion
  set estado = 'cancelada', updated_at = now()
  where id = v_orden.id;

  insert into public.trazabilidad_eventos (
    legacy_uid, orden_id, stock_pt_id, tipo, referencia, payload, usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    null, v_stock_pt.id, v_tipo_evento, v_orden.numero_expedicion,
    jsonb_build_object('cantidad_kg', v_orden.cantidad_kg, 'estado_anterior', v_orden.estado),
    null
  );

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;
