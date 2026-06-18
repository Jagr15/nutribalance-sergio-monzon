-- Enlace opcional entre salidas de PT y clientes

alter table public.stock_pt_movimientos
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

create index if not exists idx_stock_pt_movimientos_cliente_id on public.stock_pt_movimientos(cliente_id);

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

  return query
  select *
  from public.stock_pt
  where id = v_stock_pt.id;
end;
$$;
