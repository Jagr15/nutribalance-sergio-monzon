-- Fase 2: nutrición y costos automáticos

alter table public.insumos
  add column if not exists proteina_bruta_pct numeric(8,4),
  add column if not exists humedad_pct numeric(8,4),
  add column if not exists fibra_pct numeric(8,4),
  add column if not exists grasa_pct numeric(8,4),
  add column if not exists cenizas_pct numeric(8,4),
  add column if not exists unidad_base text,
  add column if not exists observaciones text;

alter table public.insumos
  add constraint insumos_proteina_bruta_pct_range check (proteina_bruta_pct is null or (proteina_bruta_pct >= 0 and proteina_bruta_pct <= 100));
alter table public.insumos
  add constraint insumos_humedad_pct_range check (humedad_pct is null or (humedad_pct >= 0 and humedad_pct <= 100));
alter table public.insumos
  add constraint insumos_fibra_pct_range check (fibra_pct is null or (fibra_pct >= 0 and fibra_pct <= 100));
alter table public.insumos
  add constraint insumos_grasa_pct_range check (grasa_pct is null or (grasa_pct >= 0 and grasa_pct <= 100));
alter table public.insumos
  add constraint insumos_cenizas_pct_range check (cenizas_pct is null or (cenizas_pct >= 0 and cenizas_pct <= 100));

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

alter table public.formula_ingredientes
  add constraint formula_ingredientes_fuente_costo_chk check (
    fuente_costo is null or fuente_costo in ('ULTIMO_LOTE', 'REFERENCIA', 'SIN_COSTO')
  );
