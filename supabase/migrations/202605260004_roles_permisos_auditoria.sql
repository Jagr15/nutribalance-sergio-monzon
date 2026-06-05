-- FASE 6: Roles, permisos y auditoría básica

create table if not exists public.auditoria_acciones (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  usuario_id uuid references public.usuarios(id),
  usuario_login text,
  usuario_nombre text,
  rol text,
  modulo text not null,
  accion text not null,
  entidad text,
  entidad_ref text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_auditoria_acciones_created_at on public.auditoria_acciones(created_at desc);
create index if not exists idx_auditoria_acciones_modulo_accion on public.auditoria_acciones(modulo, accion);
create index if not exists idx_auditoria_acciones_usuario_login on public.auditoria_acciones(usuario_login);
