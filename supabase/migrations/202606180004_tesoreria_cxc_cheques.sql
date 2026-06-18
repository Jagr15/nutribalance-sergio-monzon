alter table public.comprobantes
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

create index if not exists idx_comprobantes_cliente_id on public.comprobantes(cliente_id);

create table if not exists public.tesoreria_cheques (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  numero text not null,
  tipo text not null,
  tercero text not null,
  importe numeric(16,2) not null,
  fecha_emision date not null,
  fecha_vencimiento date not null,
  estado text not null default 'PENDIENTE',
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tesoreria_cheques_tipo_chk check (tipo in ('EMITIDO', 'RECIBIDO')),
  constraint tesoreria_cheques_estado_chk check (estado in ('PENDIENTE', 'DEPOSITADO', 'COBRADO', 'RECHAZADO', 'VENCIDO')),
  constraint tesoreria_cheques_importe_non_negative check (importe >= 0)
);

create index if not exists idx_tesoreria_cheques_tipo on public.tesoreria_cheques(tipo);
create index if not exists idx_tesoreria_cheques_vencimiento on public.tesoreria_cheques(fecha_vencimiento);
create index if not exists idx_tesoreria_cheques_cliente_id on public.tesoreria_cheques(cliente_id);

create trigger trg_tesoreria_cheques_updated_at before update on public.tesoreria_cheques
for each row execute function public.set_updated_at();
