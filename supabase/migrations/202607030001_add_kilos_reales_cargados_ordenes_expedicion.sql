alter table public.ordenes_expedicion
  add column if not exists kilos_reales_cargados numeric(14,3);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ordenes_expedicion_kilos_reales_cargados_chk'
  ) then
    alter table public.ordenes_expedicion
      add constraint ordenes_expedicion_kilos_reales_cargados_chk
      check (kilos_reales_cargados is null or kilos_reales_cargados > 0);
  end if;
end;
$$;

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

create or replace function public.despachar_orden_expedicion(
  p_orden_id uuid
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_orden public.ordenes_expedicion%rowtype;
begin
  select * into v_orden
  from public.ordenes_expedicion
  where id = p_orden_id
  for update;

  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;

  if v_orden.estado <> 'lista' then
    raise exception 'La orden debe estar en estado lista para despachar.';
  end if;

  update public.ordenes_expedicion
  set estado = 'despachada',
      updated_at = now()
  where id = v_orden.id;

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
