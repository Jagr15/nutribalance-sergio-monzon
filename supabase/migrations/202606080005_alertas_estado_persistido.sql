-- FASE 3.2: estado persistido de alertas operativas
-- La alerta calculada sigue viniendo de las vistas operativas; este cuadro guarda solo el estado de seguimiento.

create table if not exists public.alertas_estado (
  id uuid primary key default gen_random_uuid(),
  alerta_key text not null unique,
  estado text not null default 'PENDIENTE',
  comentario text,
  usuario_id uuid,
  origen text,
  prioridad text,
  ultima_actualizacion timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alertas_estado_estado_chk check (estado in ('PENDIENTE', 'EN_SEGUIMIENTO', 'ATENDIDA', 'DESCARTADA'))
);

create index if not exists idx_alertas_estado_estado on public.alertas_estado(estado);
create index if not exists idx_alertas_estado_actualizacion on public.alertas_estado(ultima_actualizacion desc);

create trigger trg_alertas_estado_updated_at before update on public.alertas_estado
for each row execute function public.set_updated_at();
