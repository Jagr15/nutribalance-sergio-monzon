-- Normaliza el cálculo financiero por fecha UTC para evitar desfasajes de timezone.

create or replace view public.vw_finanzas_kpis as
with mov_mes as (
  select
    coalesce(sum(case when tipo = 'INGRESO' and estado = 'CONFIRMADO' then monto else 0 end), 0)::numeric(16,2) as ingresos_mes,
    coalesce(sum(case when tipo = 'EGRESO' and estado = 'CONFIRMADO' then monto else 0 end), 0)::numeric(16,2) as egresos_mes
  from public.flujo_caja_movimientos
  where deleted_at is null
    and date_trunc('month', timezone('UTC', fecha)) = date_trunc('month', timezone('UTC', now()))
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
    date_trunc('month', timezone('UTC', f.fecha))::date as mes,
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
