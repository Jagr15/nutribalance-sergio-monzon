-- Ordenes de expedicion formales para salidas de Producto Terminado

create sequence if not exists public.ordenes_expedicion_numero_seq;

create table if not exists public.ordenes_expedicion (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  numero_expedicion text not null unique,
  stock_pt_id uuid not null references public.stock_pt(id) on delete restrict,
  producto_id text not null,
  nombre_producto text not null,
  lote_pt text not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  presentacion text not null,
  cantidad numeric(14,3) not null,
  estado text not null default 'REGISTRADA',
  motivo text,
  referencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ordenes_expedicion_cantidad_chk check (cantidad > 0),
  constraint ordenes_expedicion_estado_chk check (estado in ('PENDIENTE', 'REGISTRADA', 'ANULADA')),
  constraint ordenes_expedicion_presentacion_chk check (presentacion in ('GRANEL', 'BIG_BAG', 'BOLSA'))
);

create index if not exists idx_ordenes_expedicion_created_at on public.ordenes_expedicion(created_at desc);
create index if not exists idx_ordenes_expedicion_stock_pt_id on public.ordenes_expedicion(stock_pt_id);
create index if not exists idx_ordenes_expedicion_cliente_id on public.ordenes_expedicion(cliente_id);
create index if not exists idx_ordenes_expedicion_estado on public.ordenes_expedicion(estado);

create or replace function public.registrar_orden_expedicion(
  p_stock_pt_id uuid,
  p_cliente_id uuid,
  p_presentacion text,
  p_cantidad numeric,
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
  v_presentacion text := upper(trim(coalesce(p_presentacion, '')));
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad a expedir debe ser mayor a cero.';
  end if;

  if p_cliente_id is null then
    raise exception 'El cliente destino es obligatorio.';
  end if;

  if v_presentacion not in ('GRANEL', 'BIG_BAG', 'BOLSA') then
    raise exception 'La presentación seleccionada no es válida.';
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

  if v_stock_pt.cantidad_total < p_cantidad then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  v_numero_expedicion := format(
    'EXP-%s-%06s',
    to_char(now(), 'YYYY'),
    nextval('public.ordenes_expedicion_numero_seq')
  );
  v_legacy_uid := 'exp-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.ordenes_expedicion (
    legacy_uid,
    numero_expedicion,
    stock_pt_id,
    producto_id,
    nombre_producto,
    lote_pt,
    cliente_id,
    presentacion,
    cantidad,
    estado,
    motivo,
    referencia
  ) values (
    v_legacy_uid,
    v_numero_expedicion,
    v_stock_pt.id,
    coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto,
    v_stock_pt.lote,
    p_cliente_id,
    v_presentacion,
    p_cantidad,
    'REGISTRADA',
    coalesce(p_motivo, 'Despacho de producto terminado'),
    coalesce(p_referencia, v_numero_expedicion)
  );

  perform public.registrar_salida_stock_pt(
    v_stock_pt.id,
    p_cantidad,
    coalesce(p_motivo, 'Despacho de producto terminado'),
    coalesce(p_referencia, v_numero_expedicion),
    p_cliente_id
  );

  return query
  select *
  from public.ordenes_expedicion
  where legacy_uid = v_legacy_uid;
end;
$$;
