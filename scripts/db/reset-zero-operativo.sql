-- =====================================================================
-- RESET OPERATIVO A CERO
-- =====================================================================
-- WARNING: SCRIPT DESTRUCTIVO PARA ENTORNOS DE PRUEBA
-- Este script limpia datos operativos y deja maestros/configuración base.
--
-- Antes de ejecutarlo:
-- 1. Hacer backup/export completo de la base.
-- 2. Verificar que el entorno sea de pruebas o un reset autorizado.
-- 3. Confirmar que no haya procesos en curso.
--
-- Conserva:
-- - auth.users
-- - roles, usuarios, permisos, roles_permisos
-- - insumos, productos, clientes, proveedores, silos
-- - cuentas bancarias, categorías financieras, plan de cuentas
-- - parámetros / configuración base
--
-- Borra:
-- - fórmulas e ingredientes
-- - órdenes de producción
-- - órdenes de expedición / salida
-- - consumos de lotes
-- - stock MP / PT
-- - movimientos de stock
-- - cheques de tesorería
-- - flujo de caja
-- - comprobantes
-- - histórico contable importado
-- - alertas operativas / estado
-- - presupuestos mensuales
--
-- Nota: tablas opcionales se limpian sólo si existen.
-- =====================================================================

begin;

do $$
declare
  v_tables text[];
  v_sql text;
begin
  -- Formulas y trazabilidad operativa asociada
  v_tables := array[
    'public.formula_ingredientes',
    'public.formulas'
  ];
  select string_agg(quote_ident(split_part(t, '.', 2)), ', ')
    into v_sql
  from unnest(v_tables) as t
  where to_regclass(t) is not null;
  if v_sql is not null then
    execute format('truncate table %s restart identity cascade', v_sql);
  end if;

  -- Producción, consumos, stock PT y expediciones
  v_tables := array[
    'public.orden_consumo_lotes',
    'public.ordenes_expedicion',
    'public.stock_pt_movimientos',
    'public.stock_pt',
    'public.ordenes_produccion',
    'public.trazabilidad_eventos'
  ];
  select string_agg(quote_ident(split_part(t, '.', 2)), ', ')
    into v_sql
  from unnest(v_tables) as t
  where to_regclass(t) is not null;
  if v_sql is not null then
    execute format('truncate table %s restart identity cascade', v_sql);
  end if;

  -- Stock de materia prima y movimientos
  v_tables := array[
    'public.stock_movimientos',
    'public.stock_lotes_mp'
  ];
  select string_agg(quote_ident(split_part(t, '.', 2)), ', ')
    into v_sql
  from unnest(v_tables) as t
  where to_regclass(t) is not null;
  if v_sql is not null then
    execute format('truncate table %s restart identity cascade', v_sql);
  end if;

  -- Tesorería y finanzas operativas
  v_tables := array[
    'public.flujo_caja_movimientos',
    'public.comprobantes',
    'public.tesoreria_cheques',
    'public.presupuestos_mensuales',
    'public.alertas_estado',
    'public.historico_contable_importado'
  ];
  select string_agg(quote_ident(split_part(t, '.', 2)), ', ')
    into v_sql
  from unnest(v_tables) as t
  where to_regclass(t) is not null;
  if v_sql is not null then
    execute format('truncate table %s restart identity cascade', v_sql);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Tablas conservadas deliberadamente:
-- auth.users, roles, usuarios, permisos, roles_permisos
-- insumos, productos, clientes, proveedores, silos
-- cuentas_bancarias, categorias_financieras, plan_cuentas
-- parametros / configuracion base
-- ---------------------------------------------------------------------

-- Validación final: todas las tablas operativas deben quedar en cero.
do $$
declare
  v_table text;
  v_count bigint;
  v_tables text[] := array[
    'public.formulas',
    'public.formula_ingredientes',
    'public.ordenes_produccion',
    'public.orden_consumo_lotes',
    'public.ordenes_expedicion',
    'public.stock_lotes_mp',
    'public.stock_movimientos',
    'public.stock_pt',
    'public.stock_pt_movimientos',
    'public.trazabilidad_eventos',
    'public.tesoreria_cheques',
    'public.flujo_caja_movimientos',
    'public.comprobantes',
    'public.historico_contable_importado',
    'public.alertas_estado',
    'public.presupuestos_mensuales'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(v_table) is not null then
      execute format('select count(*) from %s', v_table) into v_count;
      raise notice '% => %', v_table, v_count;
    else
      raise notice '% => tabla no existente, omitida', v_table;
    end if;
  end loop;
end;
$$;

commit;
