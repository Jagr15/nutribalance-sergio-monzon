-- Fase 3: ciclo de inventario de Producto Terminado

alter table public.stock_pt
  add column if not exists cantidad_inicial numeric(14,3),
  add column if not exists costo_unitario_estimado numeric(14,6),
  add column if not exists id_formula_legacy text,
  add column if not exists version_formula integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_pt_cantidad_inicial_non_negative'
  ) then
    alter table public.stock_pt
      add constraint stock_pt_cantidad_inicial_non_negative
      check (cantidad_inicial is null or cantidad_inicial >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_pt_costo_unitario_estimado_non_negative'
  ) then
    alter table public.stock_pt
      add constraint stock_pt_costo_unitario_estimado_non_negative
      check (costo_unitario_estimado is null or costo_unitario_estimado >= 0);
  end if;
end;
$$;

create table if not exists public.stock_pt_movimientos (
  id uuid primary key default gen_random_uuid(),
  stock_pt_id uuid references public.stock_pt(id) on delete set null,
  producto_id text,
  nombre_producto text not null,
  lote text not null,
  numero_orden text,
  silo text,
  tipo text not null,
  cantidad numeric(14,3) not null,
  unidad text not null,
  costo_unitario numeric(14,6),
  valor_total numeric(14,6),
  motivo text,
  referencia text,
  created_at timestamptz not null default now(),
  constraint stock_pt_movimientos_tipo_chk check (tipo in ('INGRESO', 'SALIDA', 'AJUSTE')),
  constraint stock_pt_movimientos_cantidad_chk check (cantidad > 0),
  constraint stock_pt_movimientos_costo_chk check (costo_unitario is null or costo_unitario >= 0),
  constraint stock_pt_movimientos_valor_chk check (valor_total is null or valor_total >= 0)
);

create index if not exists idx_stock_pt_movimientos_stock_pt_id on public.stock_pt_movimientos(stock_pt_id);
create index if not exists idx_stock_pt_movimientos_producto_id on public.stock_pt_movimientos(producto_id);
create index if not exists idx_stock_pt_movimientos_created_at on public.stock_pt_movimientos(created_at desc);

create or replace function public.calcular_estado_stock_pt(
  p_saldo numeric,
  p_inicial numeric
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_inicial, 0) <= 0 then 'OK'
    when p_saldo / nullif(p_inicial, 0) <= 0.2 then 'CRITICO'
    when p_saldo / nullif(p_inicial, 0) <= 0.4 then 'BAJO'
    else 'OK'
  end;
$$;

create or replace view public.stock_pt_resumen as
with base as (
  select
    pt.id as stock_pt_id,
    coalesce(pt.id_formula_legacy, op.id_formula_legacy, pt.nombre_producto) as producto_id,
    pt.nombre_producto,
    pt.unidad_medida as unidad,
    pt.cantidad_total,
    coalesce(pt.cantidad_inicial, pt.cantidad_total) as cantidad_inicial,
    coalesce(
      pt.costo_unitario_estimado,
      case
        when pt.cantidad_total > 0 and coalesce(op.costo_total_insumos, 0) > 0
          then op.costo_total_insumos / nullif(pt.cantidad_total, 0)
        else 0
      end
    ) as costo_unitario_estimado,
    pt.estado,
    pt.updated_at,
    pt.fecha_ingreso,
    pt.numero_orden,
    pt.id_formula_legacy,
    pt.version_formula
  from public.stock_pt pt
  left join public.ordenes_produccion op
    on op.id = pt.orden_id
  where pt.deleted_at is null
)
select
  producto_id,
  nombre_producto,
  unidad,
  coalesce(sum(cantidad_total), 0)::numeric(14,3) as stock_actual,
  coalesce(sum(cantidad_total * costo_unitario_estimado), 0)::numeric(14,6) as valor_monetario,
  case
    when coalesce(sum(cantidad_inicial), 0) <= 0 then 'OK'
    when coalesce(sum(cantidad_total), 0) / nullif(coalesce(sum(cantidad_inicial), 0), 0) <= 0.2 then 'CRITICO'
    when coalesce(sum(cantidad_total), 0) / nullif(coalesce(sum(cantidad_inicial), 0), 0) <= 0.4 then 'BAJO'
    else 'OK'
  end as estado,
  count(*)::integer as cantidad_lotes,
  max(greatest(coalesce(updated_at, fecha_ingreso), fecha_ingreso)) as ultima_actualizacion,
  (array_agg(numero_orden order by coalesce(updated_at, fecha_ingreso) desc))[1] as numero_orden,
  (array_agg(id_formula_legacy order by coalesce(updated_at, fecha_ingreso) desc))[1] as id_formula,
  (array_agg(version_formula order by coalesce(updated_at, fecha_ingreso) desc))[1] as version_formula
from base
group by producto_id, nombre_producto, unidad;

create or replace function public.registrar_salida_stock_pt(
  p_stock_pt_id uuid,
  p_cantidad numeric,
  p_motivo text default null,
  p_referencia text default null
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
    referencia
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
    p_referencia
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
      'saldo_nuevo', v_stock_pt.cantidad_total - p_cantidad
    ),
    null
  );

  return query
  select *
  from public.stock_pt
  where id = v_stock_pt.id;
end;
$$;

create or replace function public.finalizar_orden_produccion(
  p_orden_id uuid,
  p_cantidad_real numeric,
  p_merma_manual numeric,
  p_destino_silo text,
  p_lote_salida text
)
returns table (
  id uuid,
  legacy_uid text,
  lote text,
  id_formula_legacy text,
  nombre_producto text,
  version_formula integer,
  cantidad_objetivo numeric,
  cantidad_real numeric,
  merma_manual numeric,
  id_silo_legacy text,
  destino_silo text,
  estado text,
  fecha_creacion timestamptz,
  usuario_responsable text,
  costo_total_insumos numeric
)
language plpgsql
as $$
declare
  v_orden public.ordenes_produccion%rowtype;
  v_silo public.silos%rowtype;
  v_stock_pt_id uuid;
  v_consumo_count integer;
  v_detalle jsonb;
  v_item record;
  v_lote_id uuid;
  v_consumo_real numeric;
  v_factor numeric;
  v_consumo_planificado numeric;
  v_disponible numeric;
  v_costo_unitario numeric;
begin
  if p_cantidad_real is null or p_cantidad_real <= 0 then
    raise exception 'La cantidad real debe ser mayor a cero.';
  end if;

  if p_destino_silo is null or btrim(p_destino_silo) = '' then
    raise exception 'Debe indicar el silo de destino.';
  end if;

  if p_lote_salida is null or btrim(p_lote_salida) = '' then
    raise exception 'Debe indicar el lote de salida de producto terminado.';
  end if;

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
    raise exception 'La orden ya se encuentra finalizada.';
  end if;

  if v_orden.estado = 'ANULADO' then
    raise exception 'No se puede finalizar una orden anulada.';
  end if;

  if v_orden.estado <> 'EN PROCESO' then
    raise exception 'Solo se puede finalizar una orden EN PROCESO.';
  end if;

  if exists (
    select 1
    from public.stock_pt pt
    where pt.orden_id = v_orden.id
      and pt.deleted_at is null
  ) then
    raise exception 'La orden ya se encuentra finalizada.';
  end if;

  select *
  into v_silo
  from public.silos
  where nombre = p_destino_silo
    and deleted_at is null
  limit 1;

  if not found then
    raise exception 'Silo de destino inválido.';
  end if;

  select count(*) into v_consumo_count
  from public.orden_consumo_lotes ocl
  where ocl.orden_id = v_orden.id;

  if v_consumo_count = 0 then
    raise exception 'La orden no tiene consumo planificado.';
  end if;

  if v_orden.cantidad_objetivo is null or v_orden.cantidad_objetivo <= 0 then
    raise exception 'La cantidad objetivo de la orden es inválida.';
  end if;

  v_factor := p_cantidad_real / v_orden.cantidad_objetivo;
  v_costo_unitario := round(coalesce(v_orden.costo_total_insumos, 0) / nullif(p_cantidad_real, 0), 6);

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
    if v_item.cantidad_usada <= 0 then
      raise exception 'Cantidad inválida para %.', v_item.nombre_insumo;
    end if;

    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;
    v_consumo_real := round(v_item.cantidad_usada * v_factor, 3);

    if v_consumo_real <= 0 then
      raise exception 'El consumo real calculado para % es inválido.', v_item.nombre_insumo;
    end if;

    select sl.cantidad_actual
    into v_disponible
    from public.stock_lotes_mp sl
    where sl.id = v_lote_id
      and sl.deleted_at is null
    for update;

    if v_disponible is null or v_disponible + 0.0001 < v_consumo_real then
      raise exception 'Stock insuficiente para % en lote %.', v_item.nombre_insumo, v_item.id_lote_legacy;
    end if;

    insert into public.stock_movimientos (
      lote_id,
      tipo,
      origen,
      cantidad,
      observaciones,
      metadata
    ) values (
      v_lote_id,
      'SALIDA',
      'PRODUCCION',
      v_consumo_real,
      format('Consumo OP %s - %s', coalesce(v_orden.legacy_uid, v_orden.lote), v_item.nombre_insumo),
      jsonb_build_object(
        'orden_id', v_orden.id,
        'orden_legacy_uid', v_orden.legacy_uid,
        'lote_mp_legacy_uid', v_item.id_lote_legacy,
        'nombre_insumo', v_item.nombre_insumo,
        'cantidad_planificada', v_item.cantidad_usada,
        'cantidad_real', v_consumo_real,
        'factor_aplicado', v_factor
      )
    );

    update public.stock_lotes_mp sl
    set cantidad_comprometida = greatest(0, sl.cantidad_comprometida - v_item.cantidad_usada)
    where sl.id = v_lote_id;
  end loop;

  update public.ordenes_produccion op
  set
    estado = 'FINALIZADO',
    cantidad_real = p_cantidad_real,
    merma_manual = p_merma_manual,
    destino_silo = p_destino_silo,
    silo_id = v_silo.id,
    id_silo_legacy = v_silo.legacy_uid
  where op.id = v_orden.id;

  select jsonb_agg(
    jsonb_build_object(
      'id_lote', ocl.id_lote_legacy,
      'id_insumo', ocl.id_insumo_legacy,
      'nombre_insumo', ocl.nombre_insumo,
      'cantidad_usada', ocl.cantidad_usada,
      'tipo_unidad', ocl.tipo_unidad,
      'costo_unitario', ocl.costo_unitario,
      'costo_total', ocl.costo_total
    )
  ) into v_detalle
  from public.orden_consumo_lotes ocl
  where ocl.orden_id = v_orden.id;

  insert into public.stock_pt (
    legacy_uid,
    orden_id,
    id_orden_legacy,
    numero_orden,
    nombre_producto,
    cantidad_total,
    cantidad_inicial,
    costo_unitario_estimado,
    id_formula_legacy,
    version_formula,
    lote,
    unidad_medida,
    estado,
    silo_id,
    id_silo_legacy,
    nombre_silo,
    detalle_insumos,
    usuario
  ) values (
    'pt-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    v_orden.legacy_uid,
    v_orden.legacy_uid,
    v_orden.nombre_producto,
    p_cantidad_real,
    p_cantidad_real,
    v_costo_unitario,
    v_orden.id_formula_legacy,
    v_orden.version_formula,
    p_lote_salida,
    'KG',
    public.calcular_estado_stock_pt(p_cantidad_real, p_cantidad_real),
    v_silo.id,
    v_silo.legacy_uid,
    v_silo.nombre,
    coalesce(v_detalle, '[]'::jsonb),
    v_orden.usuario_responsable
  )
  returning stock_pt.id into v_stock_pt_id;

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
    referencia
  ) values (
    v_stock_pt_id,
    coalesce(v_orden.id_formula_legacy, v_orden.nombre_producto),
    v_orden.nombre_producto,
    p_lote_salida,
    v_orden.legacy_uid,
    v_silo.nombre,
    'INGRESO',
    p_cantidad_real,
    'KG',
    v_costo_unitario,
    round(p_cantidad_real * coalesce(v_costo_unitario, 0), 6),
    'Ingreso por finalización de OP',
    format('OP %s', coalesce(v_orden.legacy_uid, v_orden.lote))
  );

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
    'CONSUMO_MP',
    format('Consumo MP OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object('consumos', coalesce(v_detalle, '[]'::jsonb)),
    v_orden.usuario_id
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
    v_orden.id,
    v_stock_pt_id,
    'PRODUCCION_FIN',
    format('Finalización OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object(
      'cantidad_real', p_cantidad_real,
      'merma_manual', p_merma_manual,
      'destino_silo', p_destino_silo,
      'lote_salida', p_lote_salida
    ),
    v_orden.usuario_id
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
    v_orden.id,
    v_stock_pt_id,
    'INGRESO_PT',
    format('Ingreso PT %s', p_lote_salida),
    jsonb_build_object(
      'lote', p_lote_salida,
      'cantidad_total', p_cantidad_real,
      'silo', p_destino_silo
    ),
    v_orden.usuario_id
  );

  return query
  select
    op.id,
    op.legacy_uid,
    op.lote,
    op.id_formula_legacy,
    op.nombre_producto,
    op.version_formula,
    op.cantidad_objetivo,
    op.cantidad_real,
    op.merma_manual,
    op.id_silo_legacy,
    op.destino_silo,
    op.estado,
    op.fecha_creacion,
    op.usuario_responsable,
    op.costo_total_insumos
  from public.ordenes_produccion op
  where op.id = v_orden.id;
end;
$$;
