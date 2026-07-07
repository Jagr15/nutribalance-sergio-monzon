-- Migration to check finished product stock consistency without modifying the historical production quantities (cantidad_real).
-- Validates that the referenced production order (ordenes_produccion) exists when stock adjustments are made,
-- preventing false successes for invalid or broken relationships.

create or replace function public.marcar_lista_orden_expedicion(
  p_orden_id uuid,
  p_kilos_reales_cargados numeric
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_saldo_inicial numeric;
  v_estado text;
  v_kilos_reales numeric;
begin
  select * into v_orden
  from public.ordenes_expedicion
  where id = p_orden_id
  for update;

  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;

  if v_orden.estado <> 'preparando' then
    raise exception 'La orden debe estar en preparación para marcarse como lista.';
  end if;

  if p_kilos_reales_cargados is null or p_kilos_reales_cargados <= 0 then
    raise exception 'Los kilos reales cargados deben ser mayores a cero.';
  end if;

  v_kilos_reales := round(p_kilos_reales_cargados, 3);

  select * into v_stock_pt
  from public.stock_pt
  where id = v_orden.stock_pt_id
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  if v_stock_pt.cantidad_comprometida < v_orden.cantidad_kg then
    raise exception 'La reserva comprometida no coincide con la orden.';
  end if;

  if v_stock_pt.cantidad_total < v_kilos_reales then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  -- Validate that the corresponding production order exists if referenced
  if v_stock_pt.orden_id is not null then
    perform 1 from public.ordenes_produccion where id = v_stock_pt.orden_id;
    if not found then
      raise exception 'No existe la orden de producción asociada con id %', v_stock_pt.orden_id;
    end if;
  end if;

  v_saldo_inicial := coalesce(v_stock_pt.cantidad_inicial, v_stock_pt.cantidad_total);
  v_estado := public.calcular_estado_stock_pt(v_stock_pt.cantidad_total - v_kilos_reales, v_saldo_inicial);

  update public.stock_pt
  set cantidad_total = cantidad_total - v_kilos_reales,
      cantidad_comprometida = greatest(0, cantidad_comprometida - v_orden.cantidad_kg),
      estado = v_estado,
      updated_at = now()
  where id = v_stock_pt.id;

  update public.ordenes_expedicion
  set estado = 'lista',
      kilos_reales_cargados = v_kilos_reales,
      updated_at = now()
  where id = v_orden.id;

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'SALIDA', v_kilos_reales, v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado,
    round(v_kilos_reales * coalesce(v_stock_pt.costo_unitario_estimado, 0), 6),
    coalesce(v_orden.motivo, 'Carga real de orden de expedición'),
    v_orden.numero_expedicion,
    v_orden.cliente_id
  );

  insert into public.trazabilidad_eventos (
    legacy_uid, orden_id, stock_pt_id, tipo, referencia, payload, usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    null, v_stock_pt.id, 'DESPACHO_PT', v_orden.numero_expedicion,
    jsonb_build_object('cantidad_kg', v_kilos_reales, 'estado', 'lista'),
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
  v_kilos_a_revertir numeric;
  v_saldo_inicial numeric;
  v_estado text;
begin
  select * into v_orden
  from public.ordenes_expedicion
  where id = p_orden_id
  for update;

  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;

  if v_orden.estado = 'cancelada' then
    raise exception 'La orden ya fue cancelada.';
  end if;

  select * into v_stock_pt
  from public.stock_pt
  where id = v_orden.stock_pt_id
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  -- Validate that the corresponding production order exists if referenced
  if v_stock_pt.orden_id is not null then
    perform 1 from public.ordenes_produccion where id = v_stock_pt.orden_id;
    if not found then
      raise exception 'No existe la orden de producción asociada con id %', v_stock_pt.orden_id;
    end if;
  end if;

  if v_orden.estado in ('lista', 'despachada') then
    v_kilos_a_revertir := coalesce(v_orden.kilos_reales_cargados, v_orden.cantidad_kg);
    v_saldo_inicial := coalesce(v_stock_pt.cantidad_inicial, v_stock_pt.cantidad_total);
    v_estado := public.calcular_estado_stock_pt(v_stock_pt.cantidad_total + v_kilos_a_revertir, v_saldo_inicial);

    update public.stock_pt
    set cantidad_total = cantidad_total + v_kilos_a_revertir,
        estado = v_estado,
        updated_at = now()
    where id = v_stock_pt.id;
  else
    v_kilos_a_revertir := v_orden.cantidad_kg;

    update public.stock_pt
    set cantidad_comprometida = greatest(0, cantidad_comprometida - v_kilos_a_revertir),
        updated_at = now()
    where id = v_stock_pt.id;
  end if;

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'AJUSTE', v_kilos_a_revertir, v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado, 0,
    case
      when v_orden.estado in ('lista', 'despachada') then 'Reverso de carga de orden cancelada'
      else 'Liberación de reserva por cancelación'
    end,
    v_orden.numero_expedicion, v_orden.cliente_id
  );

  update public.ordenes_expedicion
  set estado = 'cancelada',
      updated_at = now()
  where id = v_orden.id;

  insert into public.trazabilidad_eventos (
    legacy_uid, orden_id, stock_pt_id, tipo, referencia, payload, usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    null, v_stock_pt.id, 'CANCELACION_PT', v_orden.numero_expedicion,
    jsonb_build_object('cantidad_kg', v_kilos_a_revertir, 'estado_anterior', v_orden.estado),
    null
  );

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;


create or replace function public.registrar_salida_stock_pt(
  p_stock_pt_id uuid,
  p_cantidad numeric,
  p_motivo text default null,
  p_referencia text default null,
  p_cliente_id uuid default null
)
returns setof public.stock_pt
language plpgsql
as $$
declare
  v_stock_pt public.stock_pt%rowtype;
  v_saldo_inicial numeric;
  v_estado text;
  v_producto_id text;
  v_valor_total numeric;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad de salida debe ser mayor a cero.';
  end if;

  select *
  into v_stock_pt
  from public.stock_pt pt
  where pt.id = p_stock_pt_id
    and pt.deleted_at is null
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  v_saldo_inicial := coalesce(v_stock_pt.cantidad_inicial, v_stock_pt.cantidad_total);

  if v_stock_pt.cantidad_total < p_cantidad then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  -- Validate that the corresponding production order exists if referenced
  if v_stock_pt.orden_id is not null then
    perform 1 from public.ordenes_produccion where id = v_stock_pt.orden_id;
    if not found then
      raise exception 'No existe la orden de producción asociada con id %', v_stock_pt.orden_id;
    end if;
  end if;

  v_estado := public.calcular_estado_stock_pt(v_stock_pt.cantidad_total - p_cantidad, v_saldo_inicial);
  v_producto_id := coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto);
  v_valor_total := round(p_cantidad * coalesce(v_stock_pt.costo_unitario_estimado, 0), 6);

  update public.stock_pt
  set
    cantidad_total = cantidad_total - p_cantidad,
    estado = v_estado,
    updated_at = now()
  where id = v_stock_pt.id;

  insert into public.stock_pt_movimientos (
    stock_pt_id,
    producto_id,
    nombre_producto,
    lote,
    numero_orden,
    silo,
    tipo,
    cantidad,
    unidad,
    costo_unitario,
    valor_total,
    motivo,
    referencia,
    cliente_id
  ) values (
    v_stock_pt.id,
    v_producto_id,
    v_stock_pt.nombre_producto,
    v_stock_pt.lote,
    v_stock_pt.numero_orden,
    v_stock_pt.nombre_silo,
    'SALIDA',
    p_cantidad,
    v_stock_pt.unidad_medida,
    v_stock_pt.costo_unitario_estimado,
    v_valor_total,
    coalesce(p_motivo, 'Salida de producto terminado'),
    p_referencia,
    p_cliente_id
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
    v_stock_pt.orden_id,
    v_stock_pt.id,
    'DESPACHO_PT',
    coalesce(p_referencia, format('Salida PT %s', v_stock_pt.lote)),
    jsonb_build_object(
      'cantidad', p_cantidad,
      'motivo', coalesce(p_motivo, 'Salida de producto terminado'),
      'lote', v_stock_pt.lote,
      'saldo_anterior', v_stock_pt.cantidad_total,
      'saldo_nuevo', v_stock_pt.cantidad_total - p_cantidad,
      'cliente_id', p_cliente_id
    ),
    null
  );

  return query
  select *
  from public.stock_pt
  where id = v_stock_pt.id;
end;
$$;
