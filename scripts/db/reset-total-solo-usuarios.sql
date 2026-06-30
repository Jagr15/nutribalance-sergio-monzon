-- Reset total seguro conservando auth.users, public.usuarios y toda la estructura
-- Vacía tablas operativas, maestras y configuraciones sin hacer DROP.
-- Usa TRUNCATE ... RESTART IDENTITY CASCADE para respetar dependencias.

begin;

do $$
declare
  v_sql text;
  v_tables text[] := array[
    'public.ordenes_expedicion',
    'public.orden_consumo_lotes',
    'public.ordenes_produccion',
    'public.stock_pt_movimientos',
    'public.stock_pt',
    'public.stock_movimientos',
    'public.stock_lotes_mp',
    'public.trazabilidad_eventos',
    'public.historial_compras_mp',
    'public.clientes',
    'public.proveedores',
    'public.formula_ingredientes',
    'public.formulas',
    'public.insumos',
    'public.movimientos_financieros',
    'public.movimientos_costos',
    'public.costos',
    'public.flujo_caja_movimientos',
    'public.comprobantes',
    'public.presupuestos_mensuales',
    'public.historico_contable_importado',
    'public.tesoreria_cheques',
    'public.cuentas_bancarias',
    'public.alertas_estado',
    'public.alerta_configuraciones',
    'public.silos',
    'public.configuracion_empaques',
    'public.producto_empaques',
    'public.categorias_financieras',
    'public.plan_cuentas'
  ];
begin
  select string_agg(format('%I.%I', split_part(t, '.', 1), split_part(t, '.', 2)), ', ')
    into v_sql
  from unnest(v_tables) as t
  where to_regclass(t) is not null;

  if v_sql is not null then
    execute format('truncate table %s restart identity cascade', v_sql);
  end if;
end;
$$;

-- Verificación de que las tablas objetivo quedaron vacías.
select 'public.ordenes_expedicion' as tabla, count(*) as registros from public.ordenes_expedicion
union all select 'public.orden_consumo_lotes', count(*) from public.orden_consumo_lotes
union all select 'public.ordenes_produccion', count(*) from public.ordenes_produccion
union all select 'public.stock_pt_movimientos', count(*) from public.stock_pt_movimientos
union all select 'public.stock_pt', count(*) from public.stock_pt
union all select 'public.stock_movimientos', count(*) from public.stock_movimientos
union all select 'public.stock_lotes_mp', count(*) from public.stock_lotes_mp
union all select 'public.trazabilidad_eventos', count(*) from public.trazabilidad_eventos
union all select 'public.historial_compras_mp', count(*) from public.historial_compras_mp
union all select 'public.clientes', count(*) from public.clientes
union all select 'public.proveedores', count(*) from public.proveedores
union all select 'public.formula_ingredientes', count(*) from public.formula_ingredientes
union all select 'public.formulas', count(*) from public.formulas
union all select 'public.insumos', count(*) from public.insumos
union all select 'public.movimientos_financieros', count(*) from public.movimientos_financieros
union all select 'public.movimientos_costos', count(*) from public.movimientos_costos
union all select 'public.costos', count(*) from public.costos
union all select 'public.flujo_caja_movimientos', count(*) from public.flujo_caja_movimientos
union all select 'public.comprobantes', count(*) from public.comprobantes
union all select 'public.presupuestos_mensuales', count(*) from public.presupuestos_mensuales
union all select 'public.historico_contable_importado', count(*) from public.historico_contable_importado
union all select 'public.tesoreria_cheques', count(*) from public.tesoreria_cheques
union all select 'public.cuentas_bancarias', count(*) from public.cuentas_bancarias
union all select 'public.alertas_estado', count(*) from public.alertas_estado
union all select 'public.alerta_configuraciones', count(*) from public.alerta_configuraciones
union all select 'public.silos', count(*) from public.silos
union all select 'public.configuracion_empaques', count(*) from public.configuracion_empaques
union all select 'public.producto_empaques', count(*) from public.producto_empaques
union all select 'public.categorias_financieras', count(*) from public.categorias_financieras
union all select 'public.plan_cuentas', count(*) from public.plan_cuentas
order by tabla;

commit;
