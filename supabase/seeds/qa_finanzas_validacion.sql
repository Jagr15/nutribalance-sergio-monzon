-- QA validación financiera end-to-end

-- 1) KPI desde vista
select * from public.vw_finanzas_kpis;

-- 2) KPI recalculado manual (debe coincidir con vista)
with mov_mes as (
  select
    coalesce(sum(case when tipo = 'INGRESO' and estado = 'CONFIRMADO' then monto else 0 end), 0) as ingresos_mes,
    coalesce(sum(case when tipo = 'EGRESO' and estado = 'CONFIRMADO' then monto else 0 end), 0) as egresos_mes
  from public.flujo_caja_movimientos
  where deleted_at is null
    and date_trunc('month', fecha) = date_trunc('month', now())
),
cuentas as (
  select
    coalesce(sum(case when tipo = 'FACTURA_COMPRA' and estado in ('PENDIENTE', 'VENCIDO') then saldo else 0 end), 0) as cxp,
    coalesce(sum(case when tipo = 'FACTURA_VENTA' and estado in ('PENDIENTE', 'VENCIDO') then saldo else 0 end), 0) as cxc
  from public.comprobantes
  where deleted_at is null
)
select
  (select coalesce(sum(saldo_actual),0) from public.cuentas_bancarias where deleted_at is null) as saldo_actual,
  mov_mes.ingresos_mes,
  mov_mes.egresos_mes,
  (mov_mes.ingresos_mes - mov_mes.egresos_mes) as flujo_neto,
  case when mov_mes.ingresos_mes > 0 then ((mov_mes.ingresos_mes - mov_mes.egresos_mes) / mov_mes.ingresos_mes) * 100 else 0 end as margen_operativo,
  cuentas.cxp as cuentas_por_pagar,
  cuentas.cxc as cuentas_por_cobrar
from mov_mes, cuentas;

-- 3) Reportes financieros payload
select payload from public.vw_finanzas_reportes;

-- 4) Flujo neto y margen operativo directo en movimientos del mes
select
  sum(case when tipo = 'INGRESO' then monto else 0 end) as ingresos,
  sum(case when tipo = 'EGRESO' then monto else 0 end) as egresos,
  sum(case when tipo = 'INGRESO' then monto else -monto end) as flujo_neto,
  case when sum(case when tipo = 'INGRESO' then monto else 0 end) > 0
    then (sum(case when tipo = 'INGRESO' then monto else -monto end) / sum(case when tipo = 'INGRESO' then monto else 0 end)) * 100
    else 0
  end as margen_operativo
from public.flujo_caja_movimientos
where deleted_at is null
  and estado = 'CONFIRMADO'
  and date_trunc('month', fecha) = date_trunc('month', now());

-- 5) Valorización inventario (MP + PT)
select
  coalesce((
    select sum(costo_total * case when cantidad_inicial > 0 then cantidad_actual / cantidad_inicial else 0 end)
    from public.stock_lotes_mp
    where deleted_at is null
  ),0) as valor_mp,
  coalesce((
    select sum(sp.cantidad_total * case when op.cantidad_real > 0 then op.costo_total_insumos / op.cantidad_real else 0 end)
    from public.stock_pt sp
    left join public.ordenes_produccion op on op.id = sp.orden_id
    where sp.deleted_at is null
  ),0) as valor_pt;

-- 6) Integridad operación -> finanzas (conteo por origen)
select origen_operativo, count(*) as cantidad, sum(monto) as total
from public.flujo_caja_movimientos
where deleted_at is null and estado = 'CONFIRMADO'
group by origen_operativo
order by total desc;

-- 7) Confirmar que movimientos tienen links operativos
select
  legacy_uid,
  origen_operativo,
  orden_produccion_id is not null as link_orden,
  stock_lote_mp_id is not null as link_lote_mp,
  stock_pt_id is not null as link_pt
from public.flujo_caja_movimientos
where legacy_uid like 'mov-fin-%'
order by fecha;
