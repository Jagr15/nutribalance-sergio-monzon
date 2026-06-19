create table if not exists public.historico_contable_importado (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text not null,
  fecha date not null,
  tipo text not null,
  descripcion text not null,
  monto numeric(16,2) not null,
  origen_operativo text not null,
  estado text not null default 'CONFIRMADO',
  source_batch_uid text not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  constraint historico_contable_importado_tipo_chk check (tipo in ('INGRESO', 'EGRESO', 'TRANSFERENCIA')),
  constraint historico_contable_importado_estado_chk check (estado in ('PENDIENTE', 'CONFIRMADO', 'ANULADO'))
);

create unique index if not exists historico_contable_importado_legacy_uid_uk
  on public.historico_contable_importado (legacy_uid);

create unique index if not exists historico_contable_importado_content_hash_uk
  on public.historico_contable_importado (content_hash);

create index if not exists historico_contable_importado_fecha_idx
  on public.historico_contable_importado (fecha desc);
