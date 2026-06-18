-- NutriBalance Sprint 1 - Supabase/PostgreSQL base schema
-- Requires pgcrypto extension for gen_random_uuid()

create extension if not exists pgcrypto;

-- ===============
-- Catalogs
-- ===============
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  nombre text not null,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  role_id uuid references public.roles(id),
  nombre text not null,
  email text not null unique,
  esta_activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  nombre_empresa text not null,
  producto_que_provee text,
  contacto_nombre text not null,
  telefono text not null,
  email text not null,
  direccion text not null,
  documento text,
  esta_activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint proveedores_email_chk check (position('@' in email) > 1)
);

create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  nombre text not null,
  unidad_medida text not null,
  categoria text not null,
  umbral_alerta numeric(14,3) not null default 0,
  ref_costo_unitario numeric(14,6),
  esta_activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint insumos_umbral_alerta_non_negative check (umbral_alerta >= 0),
  constraint insumos_ref_costo_non_negative check (ref_costo_unitario is null or ref_costo_unitario >= 0)
);

create table if not exists public.silos (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  nombre text not null,
  descripcion text not null,
  esta_activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ===============
-- Stock MP + Ledger
-- ===============
create table if not exists public.stock_lotes_mp (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  insumo_id uuid not null references public.insumos(id),
  proveedor_id uuid not null references public.proveedores(id),
  lote text not null,
  remito_nro text not null,
  ubicacion text not null,
  cantidad_inicial numeric(14,3) not null,
  cantidad_actual numeric(14,3) not null,
  cantidad_comprometida numeric(14,3) not null default 0,
  costo_unitario numeric(14,6) not null,
  costo_total numeric(14,6) not null,
  fecha_ingreso timestamptz not null,
  id_usuario uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint stock_lotes_mp_cantidad_inicial_positive check (cantidad_inicial > 0),
  constraint stock_lotes_mp_cantidad_actual_non_negative check (cantidad_actual >= 0),
  constraint stock_lotes_mp_cantidad_comprometida_non_negative check (cantidad_comprometida >= 0),
  constraint stock_lotes_mp_costo_unitario_non_negative check (costo_unitario >= 0),
  constraint stock_lotes_mp_costo_total_non_negative check (costo_total >= 0),
  constraint stock_lotes_mp_comprometida_lte_actual check (cantidad_comprometida <= cantidad_actual)
);

create table if not exists public.stock_movimientos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.stock_lotes_mp(id),
  usuario_id uuid references public.usuarios(id),
  tipo text not null,
  origen text not null,
  cantidad numeric(14,3) not null,
  observaciones text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint stock_movimientos_tipo_chk check (tipo in ('ENTRADA', 'SALIDA', 'AJUSTE')),
  constraint stock_movimientos_origen_chk check (origen in ('COMPRA', 'PRODUCCION', 'VENTA', 'MERMA', 'AJUSTE')),
  constraint stock_movimientos_cantidad_positive check (cantidad > 0)
);

create index if not exists idx_usuarios_role_id on public.usuarios(role_id);
create index if not exists idx_usuarios_deleted_at on public.usuarios(deleted_at);
create index if not exists idx_proveedores_deleted_at on public.proveedores(deleted_at);
create index if not exists idx_insumos_deleted_at on public.insumos(deleted_at);
create index if not exists idx_silos_deleted_at on public.silos(deleted_at);
create index if not exists idx_stock_lotes_mp_insumo_id on public.stock_lotes_mp(insumo_id);
create index if not exists idx_stock_lotes_mp_proveedor_id on public.stock_lotes_mp(proveedor_id);
create index if not exists idx_stock_lotes_mp_lote on public.stock_lotes_mp(lote);
create index if not exists idx_stock_lotes_mp_deleted_at on public.stock_lotes_mp(deleted_at);
create index if not exists idx_stock_movimientos_lote_id_created_at on public.stock_movimientos(lote_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_roles_updated_at before update on public.roles
for each row execute function public.set_updated_at();
create trigger trg_usuarios_updated_at before update on public.usuarios
for each row execute function public.set_updated_at();
create trigger trg_proveedores_updated_at before update on public.proveedores
for each row execute function public.set_updated_at();
create trigger trg_insumos_updated_at before update on public.insumos
for each row execute function public.set_updated_at();
create trigger trg_silos_updated_at before update on public.silos
for each row execute function public.set_updated_at();
create trigger trg_stock_lotes_mp_updated_at before update on public.stock_lotes_mp
for each row execute function public.set_updated_at();

-- Ledger invariant: every movement updates lote stock and prevents negative stock.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
as $$
begin
  if new.tipo = 'ENTRADA' then
    update public.stock_lotes_mp
    set
      cantidad_actual = cantidad_actual + new.cantidad,
      cantidad_inicial = cantidad_inicial + new.cantidad
    where id = new.lote_id;
  elsif new.tipo = 'SALIDA' then
    update public.stock_lotes_mp
    set cantidad_actual = cantidad_actual - new.cantidad
    where id = new.lote_id
      and cantidad_actual - new.cantidad >= 0;

    if not found then
      raise exception 'Movimiento inválido: stock negativo no permitido para lote %', new.lote_id;
    end if;
  else
    -- AJUSTE: cantidad positive; metadata.delta_sign = 1 or -1
    if coalesce((new.metadata ->> 'delta_sign')::int, 1) = -1 then
      update public.stock_lotes_mp
      set cantidad_actual = cantidad_actual - new.cantidad
      where id = new.lote_id
        and cantidad_actual - new.cantidad >= 0;

      if not found then
        raise exception 'Ajuste inválido: stock negativo no permitido para lote %', new.lote_id;
      end if;
    else
      update public.stock_lotes_mp
      set cantidad_actual = cantidad_actual + new.cantidad
      where id = new.lote_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_apply_stock_movement
before insert on public.stock_movimientos
for each row execute function public.apply_stock_movement();
