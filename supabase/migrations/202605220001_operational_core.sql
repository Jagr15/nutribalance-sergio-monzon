-- Fase 1: Core operativo (formulas, ordenes, trazabilidad, stock PT)

create table if not exists public.formulas (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  nombre_producto text not null,
  version integer not null default 1,
  esta_activa boolean not null default true,
  ultima_edicion timestamptz not null default now(),
  id_usuario uuid references public.usuarios(id),
  author text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint formulas_version_positive check (version > 0)
);

create table if not exists public.formula_ingredientes (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references public.formulas(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id),
  nombre_insumo text not null,
  porcentaje numeric(8,4) not null,
  orden integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint formula_ingredientes_porcentaje_non_negative check (porcentaje >= 0)
);

create table if not exists public.ordenes_produccion (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  lote text not null,
  formula_id uuid references public.formulas(id),
  id_formula_legacy text,
  nombre_producto text not null,
  version_formula integer not null,
  cantidad_objetivo numeric(14,3) not null,
  cantidad_real numeric(14,3),
  merma_manual numeric(14,3),
  silo_id uuid references public.silos(id),
  id_silo_legacy text,
  destino_silo text,
  estado text not null,
  fecha_creacion timestamptz not null,
  usuario_responsable text not null,
  usuario_id uuid references public.usuarios(id),
  costo_total_insumos numeric(14,6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ordenes_produccion_estado_chk check (estado in ('PENDIENTE', 'EN PROCESO', 'FINALIZADO', 'ANULADO')),
  constraint ordenes_cantidad_objetivo_positive check (cantidad_objetivo > 0),
  constraint ordenes_cantidad_real_non_negative check (cantidad_real is null or cantidad_real >= 0),
  constraint ordenes_merma_non_negative check (merma_manual is null or merma_manual >= 0)
);

create table if not exists public.orden_consumo_lotes (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_produccion(id) on delete cascade,
  lote_id uuid references public.stock_lotes_mp(id),
  id_lote_legacy text,
  insumo_id uuid references public.insumos(id),
  id_insumo_legacy text,
  nombre_insumo text not null,
  cantidad_usada numeric(14,3) not null,
  tipo_unidad text not null,
  costo_unitario numeric(14,6) not null,
  costo_total numeric(14,6) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orden_consumo_lotes_cantidad_positive check (cantidad_usada > 0),
  constraint orden_consumo_lotes_costo_unitario_non_negative check (costo_unitario >= 0),
  constraint orden_consumo_lotes_costo_total_non_negative check (costo_total >= 0)
);

create table if not exists public.stock_pt (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  orden_id uuid references public.ordenes_produccion(id),
  id_orden_legacy text,
  numero_orden text,
  nombre_producto text not null,
  cantidad_total numeric(14,3) not null,
  lote text not null,
  unidad_medida text not null,
  estado text not null default 'OK',
  silo_id uuid references public.silos(id),
  id_silo_legacy text,
  nombre_silo text,
  detalle_insumos jsonb not null default '[]'::jsonb,
  fecha_ingreso timestamptz not null default now(),
  usuario text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint stock_pt_cantidad_non_negative check (cantidad_total >= 0),
  constraint stock_pt_estado_chk check (estado in ('OK', 'BAJO', 'CRITICO'))
);

create table if not exists public.trazabilidad_eventos (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  orden_id uuid references public.ordenes_produccion(id),
  stock_lote_mp_id uuid references public.stock_lotes_mp(id),
  stock_pt_id uuid references public.stock_pt(id),
  tipo text not null,
  referencia text,
  payload jsonb not null default '{}'::jsonb,
  fecha_evento timestamptz not null default now(),
  usuario_id uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  constraint trazabilidad_eventos_tipo_chk check (tipo in ('INGRESO_MP', 'RESERVA_MP', 'CONSUMO_MP', 'PRODUCCION_INICIO', 'PRODUCCION_FIN', 'INGRESO_PT', 'DESPACHO_PT', 'AJUSTE'))
);

create index if not exists idx_formulas_deleted_at on public.formulas(deleted_at);
create index if not exists idx_formula_ingredientes_formula_id on public.formula_ingredientes(formula_id);
create index if not exists idx_ordenes_produccion_deleted_at on public.ordenes_produccion(deleted_at);
create index if not exists idx_ordenes_produccion_formula_id on public.ordenes_produccion(formula_id);
create index if not exists idx_orden_consumo_lotes_orden_id on public.orden_consumo_lotes(orden_id);
create index if not exists idx_stock_pt_deleted_at on public.stock_pt(deleted_at);
create index if not exists idx_stock_pt_orden_id on public.stock_pt(orden_id);
create index if not exists idx_trazabilidad_eventos_orden_id_fecha on public.trazabilidad_eventos(orden_id, fecha_evento desc);

create trigger trg_formulas_updated_at before update on public.formulas
for each row execute function public.set_updated_at();

create trigger trg_formula_ingredientes_updated_at before update on public.formula_ingredientes
for each row execute function public.set_updated_at();

create trigger trg_ordenes_produccion_updated_at before update on public.ordenes_produccion
for each row execute function public.set_updated_at();

create trigger trg_orden_consumo_lotes_updated_at before update on public.orden_consumo_lotes
for each row execute function public.set_updated_at();

create trigger trg_stock_pt_updated_at before update on public.stock_pt
for each row execute function public.set_updated_at();
