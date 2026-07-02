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
  v_valor_total numeric;
  v_cliente_nombre text;
  v_cliente_legacy_uid text;
  v_categoria_id uuid;
  v_centro_costo_id uuid;
  v_comprobante_id uuid;
  v_comprobante_legacy_uid text;
  v_flujo_legacy_uid text;
  v_base_legacy text;
  v_fecha_vencimiento date;
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
  v_valor_total := round(v_orden.cantidad_kg * coalesce(v_stock_pt.costo_unitario_estimado, 0), 6);

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
    v_valor_total,
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

  if v_orden.cliente_id is not null and v_valor_total > 0 then
    select c.nombre, c.legacy_uid
    into v_cliente_nombre, v_cliente_legacy_uid
    from public.clientes c
    where c.id = v_orden.cliente_id
      and c.deleted_at is null;

    if not found then
      raise exception 'El cliente destino no existe.';
    end if;

    select cf.id
    into v_categoria_id
    from public.categorias_financieras cf
    where cf.legacy_uid = 'cat-ventas'
      and cf.deleted_at is null
    limit 1;

    select cc.id
    into v_centro_costo_id
    from public.centros_costo cc
    where cc.legacy_uid = 'cc-planta'
      and cc.deleted_at is null
    limit 1;

    v_base_legacy := format(
      'expedicion-%s',
      coalesce(v_orden.legacy_uid, v_orden.id::text)
    );
    v_comprobante_legacy_uid := 'cxc-' || v_base_legacy;
    v_flujo_legacy_uid := 'fcm-' || v_base_legacy;
    v_fecha_vencimiento := (now() + interval '30 days')::date;

    insert into public.comprobantes (
      legacy_uid,
      tipo,
      numero,
      fecha_emision,
      fecha_vencimiento,
      tercero,
      estado,
      total,
      saldo,
      cliente_id
    ) values (
      v_comprobante_legacy_uid,
      'FACTURA_VENTA',
      v_orden.numero_expedicion,
      now()::date,
      v_fecha_vencimiento,
      v_cliente_nombre,
      'PENDIENTE',
      v_valor_total,
      v_valor_total,
      v_orden.cliente_id
    )
    on conflict (legacy_uid) do update set
      tipo = excluded.tipo,
      numero = excluded.numero,
      fecha_emision = excluded.fecha_emision,
      fecha_vencimiento = excluded.fecha_vencimiento,
      tercero = excluded.tercero,
      estado = excluded.estado,
      total = excluded.total,
      saldo = excluded.saldo,
      cliente_id = excluded.cliente_id
    returning id into v_comprobante_id;

    insert into public.flujo_caja_movimientos (
      legacy_uid,
      fecha,
      tipo,
      origen_operativo,
      descripcion,
      monto,
      categoria_id,
      centro_costo_id,
      comprobante_id,
      stock_pt_id,
      estado,
      metadata
    ) values (
      v_flujo_legacy_uid,
      now(),
      'INGRESO',
      'VENTA_PT',
      format('Venta PT %s - Orden %s', v_stock_pt.nombre_producto, v_orden.numero_expedicion),
      v_valor_total,
      v_categoria_id,
      v_centro_costo_id,
      v_comprobante_id,
      v_stock_pt.id,
      'CONFIRMADO',
      jsonb_build_object(
        'cliente_id', v_orden.cliente_id,
        'cliente_nombre', v_cliente_nombre,
        'cliente_legacy_uid', v_cliente_legacy_uid,
        'producto', v_stock_pt.nombre_producto,
        'lote_pt', v_stock_pt.lote,
        'cantidad', v_orden.cantidad_kg,
        'cantidad_kg', v_orden.cantidad_kg,
        'orden_expedicion_id', v_orden.id,
        'numero_expedicion', v_orden.numero_expedicion,
        'referencia', v_orden.referencia,
        'comprobante_legacy_uid', v_comprobante_legacy_uid
      )
    )
    on conflict (legacy_uid) do update set
      fecha = excluded.fecha,
      tipo = excluded.tipo,
      origen_operativo = excluded.origen_operativo,
      descripcion = excluded.descripcion,
      monto = excluded.monto,
      categoria_id = excluded.categoria_id,
      centro_costo_id = excluded.centro_costo_id,
      comprobante_id = excluded.comprobante_id,
      stock_pt_id = excluded.stock_pt_id,
      estado = excluded.estado,
      metadata = excluded.metadata;
  end if;

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;
