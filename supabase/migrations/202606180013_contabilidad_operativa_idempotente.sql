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
  v_cliente_nombre text;
  v_cliente_legacy_uid text;
  v_categoria_id uuid;
  v_centro_costo_id uuid;
  v_comprobante_id uuid;
  v_comprobante_legacy_uid text;
  v_numero_comprobante text;
  v_fecha_vencimiento date;
  v_base_legacy text;
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

  if p_cliente_id is not null then
    select c.nombre, c.legacy_uid
    into v_cliente_nombre, v_cliente_legacy_uid
    from public.clientes c
    where c.id = p_cliente_id
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

    v_numero_comprobante := format(
      'FV-PT-%s-%s',
      to_char(now(), 'YYYY'),
      lpad(nextval('public.comprobantes_numero_seq')::text, 6, '0')
    );
    v_base_legacy := format(
      'fcm-venta-%s-%s-%s-%s',
      v_stock_pt.id,
      p_cliente_id,
      replace(coalesce(p_referencia, ''), ' ', '-'),
      replace(p_cantidad::text, '.', '-')
    );
    v_comprobante_legacy_uid := 'cxc-' || md5(v_base_legacy);
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
      v_numero_comprobante,
      now()::date,
      v_fecha_vencimiento,
      v_cliente_nombre,
      'PENDIENTE',
      v_valor_total,
      v_valor_total,
      p_cliente_id
    )
    on conflict (legacy_uid) do update set
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
      md5(v_base_legacy),
      now(),
      'INGRESO',
      'VENTA_PT',
      coalesce(p_referencia, format('Venta PT %s', v_stock_pt.nombre_producto)),
      v_valor_total,
      v_categoria_id,
      v_centro_costo_id,
      v_comprobante_id,
      v_stock_pt.id,
      'CONFIRMADO',
      jsonb_build_object(
        'cliente_id', p_cliente_id,
        'cliente_nombre', v_cliente_nombre,
        'cliente_legacy_uid', v_cliente_legacy_uid,
        'producto', v_stock_pt.nombre_producto,
        'lote_pt', v_stock_pt.lote,
        'cantidad', p_cantidad,
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

  return query
  select *
  from public.stock_pt
  where id = v_stock_pt.id;
end;
$$;
