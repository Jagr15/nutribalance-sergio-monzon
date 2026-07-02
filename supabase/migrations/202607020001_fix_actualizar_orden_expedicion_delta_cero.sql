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

  if v_delta <> 0 then
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
  end if;

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;
