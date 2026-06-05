-- QA validacion demo integral Fase 8.3

\echo '=== Conteos base ==='
select 'roles' tabla, count(*) total from public.roles
union all select 'usuarios', count(*) from public.usuarios
union all select 'proveedores', count(*) from public.proveedores
union all select 'insumos', count(*) from public.insumos
union all select 'silos', count(*) from public.silos
union all select 'stock_lotes_mp', count(*) from public.stock_lotes_mp
union all select 'formulas', count(*) from public.formulas
union all select 'formula_ingredientes', count(*) from public.formula_ingredientes
union all select 'ordenes_produccion', count(*) from public.ordenes_produccion
union all select 'orden_consumo_lotes', count(*) from public.orden_consumo_lotes
union all select 'stock_pt', count(*) from public.stock_pt
union all select 'trazabilidad_eventos', count(*) from public.trazabilidad_eventos
union all select 'flujo_caja_movimientos', count(*) from public.flujo_caja_movimientos
union all select 'auditoria_acciones', count(*) from public.auditoria_acciones
order by 1;

\echo '=== Integridad operativa ==='
-- Formulas sin ingredientes
select count(*) as formulas_sin_ingredientes
from public.formulas f
left join public.formula_ingredientes fi on fi.formula_id = f.id
where f.deleted_at is null
group by f.id
having count(fi.id) = 0;

-- Ingredientes con insumo invalido
select count(*) as ingredientes_sin_insumo
from public.formula_ingredientes fi
left join public.insumos i on i.id = fi.insumo_id
where i.id is null;

-- Ordenes sin formula
select count(*) as ordenes_sin_formula
from public.ordenes_produccion o
where o.deleted_at is null and o.formula_id is null;

-- Ordenes activas sin consumo planificado
select count(*) as ordenes_activas_sin_consumo
from public.ordenes_produccion o
left join public.orden_consumo_lotes ocl on ocl.orden_id = o.id
where o.deleted_at is null and o.estado in ('PENDIENTE','EN PROCESO','FINALIZADO')
group by o.id
having count(ocl.id) = 0;

-- Consumo mayor al stock disponible del lote (al momento del QA)
select count(*) as consumos_mayor_stock_actual
from public.orden_consumo_lotes ocl
join public.stock_lotes_mp sl on sl.id = ocl.lote_id
where ocl.cantidad_usada > sl.cantidad_inicial;

-- Stock negativo
select count(*) as lotes_stock_negativo
from public.stock_lotes_mp
where cantidad_actual < 0 or cantidad_comprometida < 0;

-- Lotes sin proveedor/silo (ubicacion)
select count(*) as lotes_sin_proveedor
from public.stock_lotes_mp
where proveedor_id is null;

select count(*) as lotes_sin_ubicacion
from public.stock_lotes_mp
where coalesce(trim(ubicacion), '') = '';

-- Stock PT sin orden
select count(*) as stock_pt_sin_orden
from public.stock_pt
where orden_id is null;

-- Trazabilidad sin referencia válida (sin orden, sin lote, sin pt)
select count(*) as trazabilidad_huerfana
from public.trazabilidad_eventos t
where t.orden_id is null and t.stock_lote_mp_id is null and t.stock_pt_id is null;

-- Finanzas sin categoria/cuenta
select count(*) as mov_fin_sin_categoria
from public.flujo_caja_movimientos
where categoria_id is null;

select count(*) as categorias_sin_plan_cuenta
from public.categorias_financieras
where plan_cuenta_id is null;

-- Auditoria sin usuario/modulo/accion
select count(*) as auditoria_incompleta
from public.auditoria_acciones
where usuario_id is null or coalesce(trim(modulo),'') = '' or coalesce(trim(accion),'') = '';

-- Insumos sin proteina o costo
select count(*) as insumos_sin_pb_o_costo
from public.insumos
where coalesce(proteina_bruta_pct,0) <= 0 or coalesce(ref_costo_unitario,0) <= 0;

-- Formulas que no suman 100%
select f.legacy_uid, f.nombre_producto, round(sum(fi.porcentaje)::numeric,4) total_pct
from public.formulas f
join public.formula_ingredientes fi on fi.formula_id = f.id
where f.deleted_at is null
group by f.legacy_uid, f.nombre_producto
having abs(sum(fi.porcentaje) - 100) > 0.01
order by f.nombre_producto;

\echo '=== Vistas dashboard/finanzas ==='
select * from public.vw_dashboard_stock_resumen;
select * from public.vw_dashboard_produccion_resumen;
select * from public.vw_dashboard_costos_resumen;
select count(*) as alertas_operativas from public.vw_dashboard_alertas_operativas;
select count(*) as trazabilidad_rows from public.vw_dashboard_trazabilidad;
select * from public.vw_finanzas_kpis;
select jsonb_pretty(payload) as reporte
from public.vw_finanzas_reportes;

\echo '=== Trazabilidad MP -> Orden -> PT (demo) ==='
select
  op.legacy_uid as orden,
  count(distinct t_mp.id) as eventos_mp,
  count(distinct t_pt.id) as eventos_pt,
  count(distinct pt.id) as lotes_pt
from public.ordenes_produccion op
left join public.trazabilidad_eventos t_mp on t_mp.orden_id = op.id and t_mp.tipo in ('CONSUMO_MP','RESERVA_MP')
left join public.trazabilidad_eventos t_pt on t_pt.orden_id = op.id and t_pt.tipo in ('PRODUCCION_FIN','INGRESO_PT')
left join public.stock_pt pt on pt.orden_id = op.id
where op.legacy_uid like 'demo-op-%'
group by op.legacy_uid
order by op.legacy_uid;

\echo '=== Alertas operativas resumen ==='
select tipo, prioridad, count(*) total
from public.vw_dashboard_alertas_operativas
group by tipo, prioridad
order by total desc;

\echo '=== Conteos demo prefijo ==='
select 'demo_usuarios' label, count(*) as total from public.usuarios where legacy_uid like 'demo-%'
union all select 'demo_insumos', count(*) from public.insumos where legacy_uid like 'demo-%'
union all select 'demo_lotes_mp', count(*) from public.stock_lotes_mp where legacy_uid like 'demo-%'
union all select 'demo_formulas', count(*) from public.formulas where legacy_uid like 'demo-%'
union all select 'demo_ordenes', count(*) from public.ordenes_produccion where legacy_uid like 'demo-%'
union all select 'demo_stock_pt', count(*) from public.stock_pt where legacy_uid like 'demo-%'
union all select 'demo_trazabilidad', count(*) from public.trazabilidad_eventos where legacy_uid like 'demo-%'
union all select 'demo_mov_fin', count(*) from public.flujo_caja_movimientos where legacy_uid like 'demo-%'
union all select 'demo_auditoria', count(*) from public.auditoria_acciones where legacy_uid like 'demo-%';
