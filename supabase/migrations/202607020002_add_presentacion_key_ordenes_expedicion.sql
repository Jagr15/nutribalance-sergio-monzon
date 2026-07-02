alter table public.ordenes_expedicion
  add column if not exists presentacion_key text;

do $$
begin
  update public.ordenes_expedicion
  set presentacion_key = case
    when upper(trim(coalesce(presentacion_key, ''))) in (
      'GRANEL_KG', 'TONELADA', 'BOLSA_15', 'BOLSA_20', 'BOLSA_25', 'BOLSA_40', 'BIG_BAG_500', 'BIG_BAG_1000'
    ) then upper(trim(presentacion_key))
    when presentacion = 'GRANEL' and lower(trim(coalesce(unidad_cantidad, unidad_original, 'kg'))) = 'tonelada' then 'TONELADA'
    when presentacion = 'GRANEL' then 'GRANEL_KG'
    when presentacion = 'BOLSA' and capacidad_empaque_kg = 15 then 'BOLSA_15'
    when presentacion = 'BOLSA' and capacidad_empaque_kg = 20 then 'BOLSA_20'
    when presentacion = 'BOLSA' and capacidad_empaque_kg = 25 then 'BOLSA_25'
    when presentacion = 'BOLSA' and capacidad_empaque_kg = 40 then 'BOLSA_40'
    when presentacion = 'BIG_BAG' and capacidad_empaque_kg = 500 then 'BIG_BAG_500'
    when presentacion = 'BIG_BAG' and capacidad_empaque_kg = 1000 then 'BIG_BAG_1000'
    when presentacion = 'BOLSA' then 'BOLSA_20'
    when presentacion = 'BIG_BAG' then 'BIG_BAG_1000'
    else 'GRANEL_KG'
  end
  where presentacion_key is null
     or upper(trim(coalesce(presentacion_key, ''))) not in (
      'GRANEL_KG', 'TONELADA', 'BOLSA_15', 'BOLSA_20', 'BOLSA_25', 'BOLSA_40', 'BIG_BAG_500', 'BIG_BAG_1000'
    );

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ordenes_expedicion_presentacion_key_chk'
  ) then
    alter table public.ordenes_expedicion
      add constraint ordenes_expedicion_presentacion_key_chk
      check (presentacion_key in (
        'GRANEL_KG', 'TONELADA', 'BOLSA_15', 'BOLSA_20', 'BOLSA_25', 'BOLSA_40', 'BIG_BAG_500', 'BIG_BAG_1000'
      ));
  end if;
end;
$$;

alter table public.ordenes_expedicion
  alter column presentacion_key set default 'GRANEL_KG',
  alter column presentacion_key set not null;

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
  p_referencia text default null
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

  v_cantidad_kg := round(v_cantidad_original * case when v_unidad = 'tonelada' then 1000 else 1 end, 3);

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
    modo_calculo, empaque_id, tipo_empaque, capacidad_empaque_kg, cantidad_empaques, sobrante_kg,
    estado, motivo, referencia
  ) values (
    v_legacy_uid, v_numero_expedicion, v_stock_pt.id,
    coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, p_cliente_id, v_presentacion_key, coalesce(p_presentacion, v_presentacion),
    p_cantidad, v_cantidad_original, v_unidad, v_unidad, v_cantidad_kg,
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
  p_referencia text default null
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
