-- Migration: Add deleted_at to public.ordenes_expedicion
alter table public.ordenes_expedicion add column if not exists deleted_at timestamptz;
create index if not exists idx_ordenes_expedicion_deleted_at on public.ordenes_expedicion(deleted_at);
