-- ARCA Sprint 3 - Persistencia y auditoria fiscal simulada
create extension if not exists pgcrypto;

create table if not exists public.arca_facturas (
  id uuid primary key default gen_random_uuid(),
  modalidad text not null,
  tipo_comprobante text not null,
  cliente_nombre text not null,
  cliente_documento text not null,
  cliente_condicion_iva text not null,
  moneda text not null,
  subtotal numeric(14,2) not null,
  impuestos numeric(14,2) not null,
  total numeric(14,2) not null,
  estado_fiscal text not null,
  numero_comprobante text,
  punto_venta text,
  cae text,
  cae_vencimiento timestamptz,
  provider_mode text not null,
  source_entidad text,
  source_entidad_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.arca_comprobantes (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.arca_facturas(id) on delete cascade,
  modalidad text not null,
  numero text not null,
  punto_venta text,
  cae text,
  cae_vencimiento timestamptz,
  estado text not null,
  provider_mode text not null,
  response_raw jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.arca_eventos_fiscales (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid references public.arca_facturas(id) on delete set null,
  comprobante_id uuid references public.arca_comprobantes(id) on delete set null,
  accion text not null,
  estado text not null,
  provider_mode text not null,
  mensaje text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_arca_facturas_created_at on public.arca_facturas(created_at desc);
create index if not exists idx_arca_facturas_estado_fiscal on public.arca_facturas(estado_fiscal);
create index if not exists idx_arca_comprobantes_factura_id on public.arca_comprobantes(factura_id);
create index if not exists idx_arca_comprobantes_created_at on public.arca_comprobantes(created_at desc);
create index if not exists idx_arca_eventos_fiscales_factura_id on public.arca_eventos_fiscales(factura_id);
create index if not exists idx_arca_eventos_fiscales_comprobante_id on public.arca_eventos_fiscales(comprobante_id);
create index if not exists idx_arca_eventos_fiscales_created_at on public.arca_eventos_fiscales(created_at desc);
