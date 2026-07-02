alter table public.ordenes_expedicion
  add column if not exists precio_unitario_venta numeric(14,6),
  add column if not exists total_venta numeric(14,2),
  add column if not exists moneda text not null default 'ARS';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ordenes_expedicion_precio_unitario_venta_chk'
  ) then
    alter table public.ordenes_expedicion
      add constraint ordenes_expedicion_precio_unitario_venta_chk
      check (precio_unitario_venta is null or precio_unitario_venta > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ordenes_expedicion_total_venta_chk'
  ) then
    alter table public.ordenes_expedicion
      add constraint ordenes_expedicion_total_venta_chk
      check (total_venta is null or total_venta >= 0);
  end if;
end;
$$;

create or replace function public.registrar_orden_expedicion(
  p_stock_pt_id uuid,
  p_cliente_id uuid,
  p_cantidad numeric,
  p_presentacion_key text default 'GRANEL_KG',
  p_presentacion text default null,
  p_cantidad_original numeric default null,
  p_unidad_cantidad text default null,
  p_modo_calculo text default null,
  p_empaque_id uuid default null,
  p_tipo_empaque text default null,
  p_capacidad_empaque_kg numeric default null,
  p_cantidad_empaques numeric default null,
  p_sobrante_kg numeric default null,
  p_motivo text default null,
  p_referencia text default null,
  p_precio_unitario_venta numeric default null,
  p_moneda text default 'ARS'
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_stock_pt public.stock_pt%rowtype;
  v_numero_expedicion text;
  v_legacy_uid text;
  v_presentacion_key text := upper(trim(coalesce(p_presentacion_key, 'GRANEL_KG')));
  v_presentacion text;
  v_unidad text := lower(trim(coalesce(p_unidad_cantidad, 'kg')));
  v_cantidad_original numeric := coalesce(p_cantidad_original, p_cantidad);
  v_cantidad_kg numeric;
  v_modo_calculo text;
  v_tipo_empaque text;
  v_capacidad_empaque_kg numeric;
  v_cantidad_empaques numeric;
  v_precio_unitario_venta numeric := p_precio_unitario_venta;
  v_total_venta numeric;
  v_moneda text := coalesce(nullif(trim(coalesce(p_moneda, 'ARS')), ''), 'ARS');
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad a expedir debe ser mayor a cero.';
  end if;
  if v_cantidad_original is null or v_cantidad_original <= 0 then
    raise exception 'La cantidad original debe ser mayor a cero.';
  end if;
  if v_unidad not in ('kg', 'tonelada') then
    raise exception 'La unidad de medida no es válida.';
  end if;
  if p_cliente_id is null then
    raise exception 'El cliente destino es obligatorio.';
  end if;
  if v_presentacion_key not in ('GRANEL_KG', 'TONELADA', 'BOLSA_15', 'BOLSA_20', 'BOLSA_25', 'BOLSA_40', 'BIG_BAG_500', 'BIG_BAG_1000') then
    raise exception 'La presentación seleccionada no es válida.';
  end if;
  if v_precio_unitario_venta is null or v_precio_unitario_venta <= 0 then
    raise exception 'El precio unitario de venta debe ser mayor a cero.';
  end if;

  v_cantidad_kg := round(v_cantidad_original * case when v_unidad = 'tonelada' then 1000 else 1 end, 3);
  v_total_venta := round(v_cantidad_kg * v_precio_unitario_venta, 2);

  v_presentacion := case
    when v_presentacion_key in ('GRANEL_KG', 'TONELADA') then 'GRANEL'
    when v_presentacion_key like 'BOLSA_%' then 'BOLSA'
    else 'BIG_BAG'
  end;
  v_modo_calculo := case
    when v_presentacion_key in ('GRANEL_KG', 'TONELADA') then 'kg_requeridos'
    else 'empaques'
  end;
  v_tipo_empaque := case
    when v_presentacion_key like 'BOLSA_%' then 'BOLSA'
    when v_presentacion_key like 'BIG_BAG_%' then 'BIG_BAG'
    else null
  end;
  v_capacidad_empaque_kg := case
    when v_presentacion_key = 'BOLSA_15' then 15
    when v_presentacion_key = 'BOLSA_20' then 20
    when v_presentacion_key = 'BOLSA_25' then 25
    when v_presentacion_key = 'BOLSA_40' then 40
    when v_presentacion_key = 'BIG_BAG_500' then 500
    when v_presentacion_key = 'BIG_BAG_1000' then 1000
    else null
  end;
  v_cantidad_empaques := case
    when v_tipo_empaque is null then null
    else coalesce(p_cantidad_empaques, round(v_cantidad_kg / nullif(v_capacidad_empaque_kg, 0), 3))
  end;

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
  set cantidad_comprometida = cantidad_comprometida + v_cantidad_kg,
      updated_at = now()
  where id = v_stock_pt.id;

  v_numero_expedicion := format('EXP-%s-%06s', to_char(now(), 'YYYY'), nextval('public.ordenes_expedicion_numero_seq'));
  v_legacy_uid := 'exp-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.ordenes_expedicion (
    legacy_uid, numero_expedicion, stock_pt_id, producto_id, nombre_producto, lote_pt,
    cliente_id, presentacion_key, presentacion, cantidad, cantidad_original, unidad_original, unidad_cantidad, cantidad_kg,
    precio_unitario_venta, total_venta, moneda,
    modo_calculo, empaque_id, tipo_empaque, capacidad_empaque_kg, cantidad_empaques, sobrante_kg,
    estado, motivo, referencia
  ) values (
    v_legacy_uid, v_numero_expedicion, v_stock_pt.id,
    coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, p_cliente_id, v_presentacion_key, coalesce(p_presentacion, v_presentacion),
    p_cantidad, v_cantidad_original, v_unidad, v_unidad, v_cantidad_kg,
    v_precio_unitario_venta, v_total_venta, v_moneda,
    coalesce(p_modo_calculo, v_modo_calculo), p_empaque_id, coalesce(p_tipo_empaque, v_tipo_empaque),
    coalesce(p_capacidad_empaque_kg, v_capacidad_empaque_kg), v_cantidad_empaques, coalesce(p_sobrante_kg, 0),
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
    'trz-' || replace(gen_random_uuid()::text, '-', ''), v_stock_pt.orden_id, v_stock_pt.id,
    'RESERVA_PT', v_numero_expedicion,
    jsonb_build_object('cantidad_kg', v_cantidad_kg, 'cantidad_original', v_cantidad_original, 'unidad', v_unidad, 'estado', 'pendiente'),
    null
  );

  return query select * from public.ordenes_expedicion where legacy_uid = v_legacy_uid;
end;
$$;

create or replace function public.actualizar_orden_expedicion(
  p_orden_id uuid,
  p_presentacion_key text default null,
  p_presentacion text default null,
  p_cantidad numeric default null,
  p_cantidad_original numeric default null,
  p_unidad_cantidad text default null,
  p_modo_calculo text default null,
  p_empaque_id uuid default null,
  p_tipo_empaque text default null,
  p_capacidad_empaque_kg numeric default null,
  p_cantidad_empaques numeric default null,
  p_sobrante_kg numeric default null,
  p_motivo text default null,
  p_referencia text default null,
  p_precio_unitario_venta numeric default null,
  p_moneda text default null
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_presentacion_key text;
  v_presentacion text;
  v_unidad text;
  v_cantidad_original numeric;
  v_nueva_cantidad_kg numeric;
  v_delta numeric;
  v_modo_calculo text;
  v_tipo_empaque text;
  v_capacidad_empaque_kg numeric;
  v_cantidad_empaques numeric;
  v_precio_unitario_venta numeric;
  v_total_venta numeric;
  v_moneda text;
begin
  select * into v_orden from public.ordenes_expedicion where id = p_orden_id for update;
  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'Solo se puede editar una orden pendiente.';
  end if;

  v_presentacion_key := upper(trim(coalesce(p_presentacion_key, v_orden.presentacion_key, 'GRANEL_KG')));
  if v_presentacion_key not in ('GRANEL_KG', 'TONELADA', 'BOLSA_15', 'BOLSA_20', 'BOLSA_25', 'BOLSA_40', 'BIG_BAG_500', 'BIG_BAG_1000') then
    raise exception 'La presentación seleccionada no es válida.';
  end if;

  v_unidad := lower(trim(coalesce(p_unidad_cantidad, v_orden.unidad_cantidad)));
  if v_unidad not in ('kg', 'tonelada') then
    raise exception 'La unidad de medida no es válida.';
  end if;

  v_cantidad_original := coalesce(p_cantidad_original, v_orden.cantidad_original);
  if coalesce(p_cantidad, v_orden.cantidad_original) <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  v_nueva_cantidad_kg := round(v_cantidad_original * case when v_unidad = 'tonelada' then 1000 else 1 end, 3);

  v_presentacion := case
    when v_presentacion_key in ('GRANEL_KG', 'TONELADA') then 'GRANEL'
    when v_presentacion_key like 'BOLSA_%' then 'BOLSA'
    else 'BIG_BAG'
  end;
  v_modo_calculo := case
    when v_presentacion_key in ('GRANEL_KG', 'TONELADA') then 'kg_requeridos'
    else 'empaques'
  end;
  v_tipo_empaque := case
    when v_presentacion_key like 'BOLSA_%' then 'BOLSA'
    when v_presentacion_key like 'BIG_BAG_%' then 'BIG_BAG'
    else null
  end;
  v_capacidad_empaque_kg := case
    when v_presentacion_key = 'BOLSA_15' then 15
    when v_presentacion_key = 'BOLSA_20' then 20
    when v_presentacion_key = 'BOLSA_25' then 25
    when v_presentacion_key = 'BOLSA_40' then 40
    when v_presentacion_key = 'BIG_BAG_500' then 500
    when v_presentacion_key = 'BIG_BAG_1000' then 1000
    else null
  end;
  v_cantidad_empaques := case
    when v_tipo_empaque is null then null
    else coalesce(p_cantidad_empaques, v_orden.cantidad_empaques, round(v_nueva_cantidad_kg / nullif(v_capacidad_empaque_kg, 0), 3))
  end;
  v_delta := v_nueva_cantidad_kg - v_orden.cantidad_kg;
  v_precio_unitario_venta := coalesce(p_precio_unitario_venta, v_orden.precio_unitario_venta);
  if v_precio_unitario_venta is null or v_precio_unitario_venta <= 0 then
    raise exception 'El precio unitario de venta debe ser mayor a cero.';
  end if;
  v_total_venta := round(v_nueva_cantidad_kg * v_precio_unitario_venta, 2);
  v_moneda := coalesce(nullif(trim(coalesce(p_moneda, v_orden.moneda, 'ARS')), ''), 'ARS');

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
    presentacion_key = v_presentacion_key,
    presentacion = coalesce(p_presentacion, v_presentacion),
    cantidad = coalesce(p_cantidad, cantidad),
    cantidad_original = v_cantidad_original,
    unidad_original = coalesce(p_unidad_cantidad, unidad_original),
    unidad_cantidad = v_unidad,
    cantidad_kg = v_nueva_cantidad_kg,
    precio_unitario_venta = v_precio_unitario_venta,
    total_venta = v_total_venta,
    moneda = v_moneda,
    modo_calculo = coalesce(p_modo_calculo, v_modo_calculo),
    empaque_id = coalesce(p_empaque_id, empaque_id),
    tipo_empaque = coalesce(p_tipo_empaque, v_tipo_empaque),
    capacidad_empaque_kg = coalesce(p_capacidad_empaque_kg, v_capacidad_empaque_kg),
    cantidad_empaques = coalesce(p_cantidad_empaques, v_orden.cantidad_empaques, v_cantidad_empaques),
    sobrante_kg = coalesce(p_sobrante_kg, sobrante_kg),
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
  v_costo_unitario_fallback numeric;
  v_costo_unitario_interno numeric;
  v_valor_total_interno numeric;
  v_total_venta numeric;
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

  select
    case
      when coalesce(op.costo_total_insumos, 0) > 0
       and coalesce(op.cantidad_real, 0) > 0
        then op.costo_total_insumos / nullif(op.cantidad_real, 0)
      when coalesce(op.costo_total_insumos, 0) > 0
       and coalesce(op.cantidad_objetivo, 0) > 0
        then op.costo_total_insumos / nullif(op.cantidad_objetivo, 0)
      else 0
    end
  into v_costo_unitario_fallback
  from public.ordenes_produccion op
  where op.id = v_stock_pt.orden_id;

  v_saldo_inicial := coalesce(v_stock_pt.cantidad_inicial, v_stock_pt.cantidad_total);
  v_estado := public.calcular_estado_stock_pt(v_stock_pt.cantidad_total - v_orden.cantidad_kg, v_saldo_inicial);
  v_costo_unitario_interno := coalesce(nullif(v_stock_pt.costo_unitario_estimado, 0), v_costo_unitario_fallback, 0);
  v_valor_total_interno := round(v_orden.cantidad_kg * v_costo_unitario_interno, 6);
  v_total_venta := coalesce(nullif(v_orden.total_venta, 0), round(v_orden.cantidad_kg * coalesce(v_orden.precio_unitario_venta, 0), 2), v_valor_total_interno, 0);

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
    'SALIDA', v_orden.cantidad_kg, v_stock_pt.unidad_medida, v_costo_unitario_interno,
    v_valor_total_interno,
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

  if v_orden.cliente_id is not null and v_total_venta > 0 then
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
      v_total_venta,
      v_total_venta,
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
      v_total_venta,
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
        'precio_unitario_venta', v_orden.precio_unitario_venta,
        'total_venta', v_total_venta,
        'costo_unitario_interno', v_costo_unitario_interno,
        'valor_total_interno', v_valor_total_interno,
        'origen_total_venta', case
          when coalesce(v_orden.total_venta, 0) > 0 then 'orden_expedicion'
          when coalesce(v_orden.precio_unitario_venta, 0) > 0 then 'precio_unitario_venta'
          else 'costo_fallback'
        end,
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
