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
create index if not exists idx_clientes_deleted_at on public.clientes(deleted_at);
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
create trigger trg_clientes_updated_at before update on public.clientes
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

-- ===============
-- Core Operativo (Fase 1)
-- ===============
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

-- ===============
-- Nutrición y Costos de Fórmulas (Fase 2)
-- ===============
alter table public.insumos
  add column if not exists proteina_bruta_pct numeric(8,4),
  add column if not exists humedad_pct numeric(8,4),
  add column if not exists fibra_pct numeric(8,4),
  add column if not exists grasa_pct numeric(8,4),
  add column if not exists cenizas_pct numeric(8,4),
  add column if not exists unidad_base text,
  add column if not exists observaciones text;

alter table public.formulas
  add column if not exists proteina_calculada_pct numeric(10,4),
  add column if not exists costo_total numeric(14,6),
  add column if not exists costo_por_kg numeric(14,6),
  add column if not exists costo_por_tonelada numeric(14,6),
  add column if not exists advertencias_nutricionales jsonb not null default '[]'::jsonb,
  add column if not exists advertencias_costos jsonb not null default '[]'::jsonb;

alter table public.formula_ingredientes
  add column if not exists aporte_proteina_pct numeric(10,6),
  add column if not exists aporte_proteina_g_kg numeric(10,6),
  add column if not exists costo_unitario_usado numeric(14,6),
  add column if not exists costo_contribucion_kg numeric(14,6),
  add column if not exists fuente_costo text;
