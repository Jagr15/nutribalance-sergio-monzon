-- Anulación segura de OP con liberación atómica de reserva

create or replace function public.anular_orden_produccion_con_liberacion(
  p_orden_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_orden public.ordenes_produccion%rowtype;
  v_item record;
  v_lote_id uuid;
begin
  select *
  into v_orden
  from public.ordenes_produccion op
  where op.id = p_orden_id
    and op.deleted_at is null
  for update;

  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  if v_orden.estado = 'FINALIZADO' then
    raise exception 'No se puede anular una orden finalizada.';
  end if;

  if v_orden.estado = 'ANULADO' then
    return true;
  end if;

  for v_item in
    select
      ocl.id_lote_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(
        ocl.lote_id,
        sl_legacy.id,
        sl_nombre.id
      ) as lote_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.stock_lotes_mp sl_legacy
      on sl_legacy.legacy_uid = ocl.id_lote_legacy
      and sl_legacy.deleted_at is null
    left join public.stock_lotes_mp sl_nombre
      on sl_nombre.lote = ocl.id_lote_legacy
      and sl_nombre.deleted_at is null
    where ocl.orden_id = v_orden.id
  loop
    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;

    update public.stock_lotes_mp sl
    set cantidad_comprometida = greatest(0, sl.cantidad_comprometida - v_item.cantidad_usada)
    where sl.id = v_lote_id;
  end loop;

  update public.ordenes_produccion op
  set
    deleted_at = now(),
    estado = 'ANULADO'
  where op.id = v_orden.id;

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    'AJUSTE',
    format('Anulación OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object(
      'accion', 'ANULAR_OP',
      'orden_id', v_orden.id,
      'orden_legacy_uid', v_orden.legacy_uid
    ),
    v_orden.usuario_id
  );

  return true;
end;
$$;
