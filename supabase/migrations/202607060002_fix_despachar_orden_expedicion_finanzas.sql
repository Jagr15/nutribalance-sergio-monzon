-- Migration to restore financial registration when dispatching output orders.
-- Restores creation of vouchers (comprobantes) and cash flows (flujo_caja_movimientos) upon calling despachar_orden_expedicion.
-- Keeps stock reduction cleanly isolated within marcar_lista_orden_expedicion.

create or replace function public.despachar_orden_expedicion(
  p_orden_id uuid
)
returns setof public.ordenes_expedicion
language plpgsql
as $$
declare
  v_orden public.ordenes_expedicion%rowtype;
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

  update public.ordenes_expedicion
  set estado = 'despachada',
      updated_at = now()
  where id = v_orden.id;

  -- Financial calculations
  v_total_venta := coalesce(
    v_orden.total_venta,
    round(coalesce(v_orden.kilos_reales_cargados, v_orden.cantidad_kg, 0) * coalesce(v_orden.precio_unitario_venta, 0), 2)
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
      format('Venta PT %s - Orden %s', v_orden.nombre_producto, v_orden.numero_expedicion),
      v_total_venta,
      v_categoria_id,
      v_centro_costo_id,
      v_comprobante_id,
      v_orden.stock_pt_id,
      'CONFIRMADO',
      jsonb_build_object(
        'cliente_id', v_orden.cliente_id,
        'cliente_nombre', v_cliente_nombre,
        'cliente_legacy_uid', v_cliente_legacy_uid,
        'producto', v_orden.nombre_producto,
        'cantidad', coalesce(v_orden.kilos_reales_cargados, v_orden.cantidad_kg),
        'cantidad_kg', coalesce(v_orden.kilos_reales_cargados, v_orden.cantidad_kg),
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
