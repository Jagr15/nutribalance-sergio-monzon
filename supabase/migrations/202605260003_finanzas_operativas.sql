-- FASE 5: Finanzas y flujo de caja operativo

create table if not exists public.plan_cuentas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  tipo text not null,
  naturaleza text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint plan_cuentas_tipo_chk check (tipo in ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO', 'RESULTADO')),
  constraint plan_cuentas_naturaleza_chk check (naturaleza in ('DEUDORA', 'ACREEDORA'))
);

create table if not exists public.categorias_financieras (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  nombre text not null,
  tipo_movimiento text not null,
  area text not null,
  plan_cuenta_id uuid references public.plan_cuentas(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint categorias_tipo_mov_chk check (tipo_movimiento in ('INGRESO', 'EGRESO', 'TRANSFERENCIA'))
);

create table if not exists public.centros_costo (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  nombre text not null,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  banco text not null,
  alias text,
  cbu text,
  moneda text not null default 'ARS',
  saldo_actual numeric(16,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.formas_pago (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  nombre text not null,
  tipo text not null,
  dias_plazo integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint formas_pago_tipo_chk check (tipo in ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'CTA_CTE')),
  constraint formas_pago_dias_plazo_non_negative check (dias_plazo >= 0)
);

create table if not exists public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  tipo text not null,
  numero text,
  fecha_emision date not null,
  fecha_vencimiento date,
  tercero text,
  estado text not null default 'PENDIENTE',
  total numeric(16,2) not null default 0,
  saldo numeric(16,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comprobantes_tipo_chk check (tipo in ('FACTURA_COMPRA', 'FACTURA_VENTA', 'RECIBO', 'PAGO', 'AJUSTE')),
  constraint comprobantes_estado_chk check (estado in ('PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO'))
);

create table if not exists public.flujo_caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  fecha timestamptz not null default now(),
  tipo text not null,
  origen_operativo text,
  descripcion text not null,
  monto numeric(16,2) not null,
  categoria_id uuid references public.categorias_financieras(id),
  centro_costo_id uuid references public.centros_costo(id),
  cuenta_bancaria_id uuid references public.cuentas_bancarias(id),
  forma_pago_id uuid references public.formas_pago(id),
  comprobante_id uuid references public.comprobantes(id),
  orden_produccion_id uuid references public.ordenes_produccion(id),
  stock_lote_mp_id uuid references public.stock_lotes_mp(id),
  stock_pt_id uuid references public.stock_pt(id),
  estado text not null default 'CONFIRMADO',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint flujo_caja_tipo_chk check (tipo in ('INGRESO', 'EGRESO', 'TRANSFERENCIA')),
  constraint flujo_caja_estado_chk check (estado in ('PENDIENTE', 'CONFIRMADO', 'ANULADO')),
  constraint flujo_caja_monto_positive check (monto > 0)
);

create table if not exists public.presupuestos_mensuales (
  id uuid primary key default gen_random_uuid(),
  legacy_uid text unique,
  anio integer not null,
  mes integer not null,
  categoria_id uuid references public.categorias_financieras(id),
  centro_costo_id uuid references public.centros_costo(id),
  monto_presupuestado numeric(16,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint presupuestos_mes_chk check (mes between 1 and 12),
  constraint presupuestos_monto_non_negative check (monto_presupuestado >= 0)
);

create index if not exists idx_categorias_financieras_tipo on public.categorias_financieras(tipo_movimiento);
create index if not exists idx_flujo_caja_fecha on public.flujo_caja_movimientos(fecha desc);
create index if not exists idx_flujo_caja_tipo_estado on public.flujo_caja_movimientos(tipo, estado);
create index if not exists idx_flujo_caja_categoria on public.flujo_caja_movimientos(categoria_id);
create index if not exists idx_flujo_caja_orden on public.flujo_caja_movimientos(orden_produccion_id);
create index if not exists idx_comprobantes_estado on public.comprobantes(estado);
create index if not exists idx_presupuestos_periodo on public.presupuestos_mensuales(anio, mes);

create trigger trg_plan_cuentas_updated_at before update on public.plan_cuentas
for each row execute function public.set_updated_at();
create trigger trg_categorias_financieras_updated_at before update on public.categorias_financieras
for each row execute function public.set_updated_at();
create trigger trg_centros_costo_updated_at before update on public.centros_costo
for each row execute function public.set_updated_at();
create trigger trg_cuentas_bancarias_updated_at before update on public.cuentas_bancarias
for each row execute function public.set_updated_at();
create trigger trg_formas_pago_updated_at before update on public.formas_pago
for each row execute function public.set_updated_at();
create trigger trg_comprobantes_updated_at before update on public.comprobantes
for each row execute function public.set_updated_at();
create trigger trg_flujo_caja_movimientos_updated_at before update on public.flujo_caja_movimientos
for each row execute function public.set_updated_at();
create trigger trg_presupuestos_mensuales_updated_at before update on public.presupuestos_mensuales
for each row execute function public.set_updated_at();

create or replace view public.vw_finanzas_kpis as
with mov_mes as (
  select
    coalesce(sum(case when tipo = 'INGRESO' and estado = 'CONFIRMADO' then monto else 0 end), 0)::numeric(16,2) as ingresos_mes,
    coalesce(sum(case when tipo = 'EGRESO' and estado = 'CONFIRMADO' then monto else 0 end), 0)::numeric(16,2) as egresos_mes
  from public.flujo_caja_movimientos
  where deleted_at is null
    and date_trunc('month', fecha) = date_trunc('month', now())
),
cuentas as (
  select
    coalesce(sum(case when c.tipo = 'FACTURA_COMPRA' and c.estado in ('PENDIENTE', 'VENCIDO') then c.saldo else 0 end), 0)::numeric(16,2) as cuentas_por_pagar,
    coalesce(sum(case when c.tipo = 'FACTURA_VENTA' and c.estado in ('PENDIENTE', 'VENCIDO') then c.saldo else 0 end), 0)::numeric(16,2) as cuentas_por_cobrar
  from public.comprobantes c
  where c.deleted_at is null
),
oper as (
  select
    coalesce(sum(case when o.estado = 'FINALIZADO' then o.costo_total_insumos else 0 end), 0)::numeric(16,2) as costo_produccion,
    coalesce(sum(case when o.estado = 'FINALIZADO' then coalesce(o.merma_manual, 0) * (case when o.cantidad_real > 0 then o.costo_total_insumos / o.cantidad_real else 0 end) else 0 end), 0)::numeric(16,2) as perdida_merma
  from public.ordenes_produccion o
  where o.deleted_at is null
),
inv as (
  select
    coalesce((select sum(costo_total * case when cantidad_inicial > 0 then cantidad_actual / cantidad_inicial else 0 end) from public.stock_lotes_mp where deleted_at is null), 0)::numeric(16,2)
    +
    coalesce((select sum(sp.cantidad_total * case when op.cantidad_real > 0 then op.costo_total_insumos / op.cantidad_real else 0 end)
      from public.stock_pt sp
      left join public.ordenes_produccion op on op.id = sp.orden_id
      where sp.deleted_at is null), 0)::numeric(16,2) as valorizacion_inventario
),
saldo as (
  select coalesce(sum(saldo_actual), 0)::numeric(16,2) as saldo_actual
  from public.cuentas_bancarias
  where deleted_at is null
)
select
  saldo.saldo_actual,
  mov_mes.ingresos_mes,
  mov_mes.egresos_mes,
  (mov_mes.ingresos_mes - mov_mes.egresos_mes)::numeric(16,2) as flujo_neto,
  case when mov_mes.ingresos_mes > 0 then ((mov_mes.ingresos_mes - mov_mes.egresos_mes) / mov_mes.ingresos_mes) * 100 else 0 end::numeric(10,4) as margen_operativo,
  oper.costo_produccion,
  inv.valorizacion_inventario,
  cuentas.cuentas_por_pagar,
  cuentas.cuentas_por_cobrar,
  oper.perdida_merma
from mov_mes, cuentas, oper, inv, saldo;

create or replace view public.vw_finanzas_reportes as
with base as (
  select
    date_trunc('month', f.fecha)::date as mes,
    f.tipo,
    coalesce(cf.nombre, 'Sin categoría') as categoria,
    f.monto,
    coalesce(f.origen_operativo, 'MANUAL') as origen_operativo
  from public.flujo_caja_movimientos f
  left join public.categorias_financieras cf on cf.id = f.categoria_id
  where f.deleted_at is null
    and f.estado = 'CONFIRMADO'
),
rentabilidad as (
  select
    coalesce(o.id_formula_legacy, 'SIN_FORMULA') as id_formula,
    o.nombre_producto,
    sum(coalesce(o.costo_total_insumos, 0))::numeric(16,2) as costo_total,
    sum(coalesce(o.cantidad_real, 0))::numeric(16,3) as kg_total
  from public.ordenes_produccion o
  where o.deleted_at is null
    and o.estado = 'FINALIZADO'
  group by 1, 2
)
select jsonb_build_object(
  'flujo_caja_mensual', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'mes', to_char(x.mes, 'YYYY-MM'),
      'ingresos', x.ingresos,
      'egresos', x.egresos,
      'neto', x.neto
    ) order by x.mes), '[]'::jsonb)
    from (
      select
        mes,
        sum(case when tipo = 'INGRESO' then monto else 0 end) as ingresos,
        sum(case when tipo = 'EGRESO' then monto else 0 end) as egresos,
        sum(case when tipo = 'INGRESO' then monto else -monto end) as neto
      from base
      group by mes
    ) x
  ),
  'gastos_por_categoria', (
    select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'monto', total) order by total desc), '[]'::jsonb)
    from (select categoria, sum(monto)::numeric(16,2) as total from base where tipo = 'EGRESO' group by categoria) g
  ),
  'ingresos_por_categoria', (
    select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'monto', total) order by total desc), '[]'::jsonb)
    from (select categoria, sum(monto)::numeric(16,2) as total from base where tipo = 'INGRESO' group by categoria) i
  ),
  'rentabilidad_por_formula', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id_formula', id_formula,
      'nombre_producto', nombre_producto,
      'costo_total', costo_total,
      'kg_total', kg_total,
      'costo_promedio_kg', case when kg_total > 0 then costo_total / kg_total else 0 end
    ) order by costo_total desc), '[]'::jsonb)
    from rentabilidad
  ),
  'costo_operativo_mensual', (
    select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(mes, 'YYYY-MM'), 'monto', total) order by mes), '[]'::jsonb)
    from (select mes, sum(monto)::numeric(16,2) as total from base where tipo = 'EGRESO' group by mes) c
  )
) as payload;
