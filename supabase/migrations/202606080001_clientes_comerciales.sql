-- Tabla de clientes comerciales para persistencia real en Supabase

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  nombre text not null,
  razon_social text,
  cuit text,
  email text,
  telefono text,
  direccion text,
  localidad text,
  provincia text,
  segmento text,
  ubicacion text,
  contacto text,
  producto_principal text,
  condicion_comercial text,
  estado text not null default 'Activo',
  observaciones text,
  ultima_compra date,
  saldo_pendiente_ars numeric(14,2) not null default 0,
  esta_activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clientes_saldo_non_negative check (saldo_pendiente_ars >= 0)
);

create index if not exists idx_clientes_deleted_at on public.clientes(deleted_at);

create trigger trg_clientes_updated_at before update on public.clientes
for each row execute function public.set_updated_at();
