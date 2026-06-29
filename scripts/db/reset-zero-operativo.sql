-- Reset operativo a cero para cliente / QA
-- Conserva auth.users y usuarios administrativos del sistema.
-- Limpia datos operativos, históricos, seed/demo/test/prueba/qa.

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
    'public.trazabilidad_eventos',
    'public.flujo_caja_movimientos',
    'public.comprobantes',
    'public.tesoreria_cheques',
    'public.presupuestos_mensuales',
    'public.historico_contable_importado',
    'public.alertas_estado',
    'public.alerta_configuraciones',
    'public.stock_movimientos',
    'public.stock_lotes_mp',
    'public.formula_ingredientes',
    'public.formulas',
    'public.clientes',
    'public.proveedores',
    'public.silos',
    'public.insumos',
    'public.productos',
    'public.cuentas_bancarias',
    'public.categorias_financieras',
    'public.plan_cuentas',
    'public.producto_empaques',
    'public.movimientos_financieros',
    'public.movimientos_costos',
    'public.costos',
    'public.movimientos_costos',
    'public.historial_compras_mp'
  ];
begin
  select string_agg(format('%I', split_part(t, '.', 2)), ', ')
    into v_sql
  from unnest(v_tables) as t
  where to_regclass(t) is not null;

  if v_sql is not null then
    execute format('truncate table %s restart identity cascade', v_sql);
  end if;
end;
$$;

commit;
