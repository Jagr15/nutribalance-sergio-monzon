create or replace function public.cancelar_orden_expedicion(
  p_orden_id uuid
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_stock_pt_id uuid;
  v_rows_updated integer;
  v_tipo_evento text;
begin
  select * into v_orden
  from public.ordenes_expedicion
  where id = p_orden_id
  for update;

  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;

  if v_orden.estado = 'cancelada' then
    return query select * from public.ordenes_expedicion where id = p_orden_id;
  end if;

  if v_orden.estado not in ('pendiente', 'preparando', 'lista') then
    raise exception 'No se puede cancelar una orden ya despachada.';
  end if;

  v_stock_pt_id := v_orden.stock_pt_id;

  select * into v_stock_pt
  from public.stock_pt
  where id = v_stock_pt_id
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  update public.stock_pt
  set cantidad_comprometida = greatest(0, coalesce(cantidad_comprometida, 0) - v_orden.cantidad_kg),
      updated_at = now()
  where id = v_stock_pt_id;

  get diagnostics v_rows_updated = row_count;

  if coalesce(v_rows_updated, 0) <> 1 then
    raise exception 'No se pudo liberar la reserva del stock PT.';
  end if;

  v_tipo_evento := case when v_orden.estado = 'lista' then 'CANCELACION_EXPEDICION' else 'LIBERACION_RESERVA_PT' end;

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt_id,
    coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto,
    v_stock_pt.lote,
    v_stock_pt.numero_orden,
    v_stock_pt.nombre_silo,
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
    null, v_stock_pt_id, v_tipo_evento, v_orden.numero_expedicion,
    jsonb_build_object('cantidad_kg', v_orden.cantidad_kg, 'estado_anterior', v_orden.estado),
    null
  );

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;
