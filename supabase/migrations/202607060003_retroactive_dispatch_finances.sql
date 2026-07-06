-- Migration to retroactively generate missing comprobantes and flujo_caja_movimientos for already dispatched orders.
-- Cleans up any inconsistencies for orders that were dispatched when financial hooks were disabled.

do $$
declare
  v_rec record;
  v_cliente_nombre text;
  v_cliente_legacy_uid text;
  v_categoria_id uuid;
  v_centro_costo_id uuid;
  v_comprobante_id uuid;
  v_comprobante_legacy_uid text;
  v_flujo_legacy_uid text;
  v_total_venta numeric;
begin
  select cf.id into v_categoria_id
  from public.categorias_financieras cf
  where cf.legacy_uid = 'cat-ventas' and cf.deleted_at is null limit 1;

  select cc.id into v_centro_costo_id
  from public.centros_costo cc
  where cc.legacy_uid = 'cc-planta' and cc.deleted_at is null limit 1;

  for v_rec in
    select
      oe.id,
      oe.legacy_uid,
      oe.numero_expedicion,
      oe.cliente_id,
      oe.stock_pt_id,
      oe.nombre_producto,
      oe.lote_pt,
      oe.referencia,
      oe.created_at,
      coalesce(oe.kilos_reales_cargados, oe.cantidad_kg, 0) as cantidad,
      coalesce(oe.total_venta, round(coalesce(oe.kilos_reales_cargados, oe.cantidad_kg, 0) * coalesce(oe.precio_unitario_venta, 0), 2)) as computed_total
    from public.ordenes_expedicion oe
    where oe.estado = 'despachada'
      and oe.cliente_id is not null
      and not exists (
        select 1 from public.comprobantes c
        where c.cliente_id = oe.cliente_id
          and c.tipo = 'FACTURA_VENTA'
          and (c.numero = oe.numero_expedicion or c.legacy_uid = 'cxc-expedicion-' || coalesce(oe.legacy_uid, oe.id::text))
      )
  loop
    v_total_venta := v_rec.computed_total;
    if v_total_venta > 0 then
      select c.nombre, c.legacy_uid
      into v_cliente_nombre, v_cliente_legacy_uid
      from public.clientes c
      where c.id = v_rec.cliente_id;

      v_comprobante_legacy_uid := 'cxc-expedicion-' || coalesce(v_rec.legacy_uid, v_rec.id::text);
      v_flujo_legacy_uid := 'fcm-expedicion-' || coalesce(v_rec.legacy_uid, v_rec.id::text);

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
        v_rec.numero_expedicion,
        v_rec.created_at::date,
        (v_rec.created_at + interval '30 days')::date,
        v_cliente_nombre,
        'PENDIENTE',
        v_total_venta,
        v_total_venta,
        v_rec.cliente_id
      )
      on conflict (legacy_uid) do update set
        total = excluded.total,
        saldo = excluded.saldo
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
        v_rec.created_at,
        'INGRESO',
        'VENTA_PT',
        format('Venta PT %s - Orden %s (Retroactiva)', v_rec.nombre_producto, v_rec.numero_expedicion),
        v_total_venta,
        v_categoria_id,
        v_centro_costo_id,
        v_comprobante_id,
        v_rec.stock_pt_id,
        'CONFIRMADO',
        jsonb_build_object(
          'cliente_id', v_rec.cliente_id,
          'cliente_nombre', v_cliente_nombre,
          'cliente_legacy_uid', v_cliente_legacy_uid,
          'producto', v_rec.nombre_producto,
          'cantidad', v_rec.cantidad,
          'cantidad_kg', v_rec.cantidad,
          'orden_expedicion_id', v_rec.id,
          'numero_expedicion', v_rec.numero_expedicion,
          'referencia', v_rec.referencia,
          'comprobante_legacy_uid', v_comprobante_legacy_uid
        )
      )
      on conflict (legacy_uid) do update set
        monto = excluded.monto,
        metadata = excluded.metadata;
    end if;
  end loop;
end;
$$;
