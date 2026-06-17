# FASE 3.0 - Auditoria integral de Dashboard y KPIs

## Resumen ejecutivo

- El dashboard operativo principal ya lee vistas reales de Supabase para stock, produccion, costos y alertas.
- Aun asi, conserva fallback a `ApiService`, por lo que si una vista falla o el entorno cae en mock/demo, la interfaz sigue mostrando datos estimados sin bloquearse.
- La inconsistencia mas clara encontrada es `Evolucion costos (linea)`: la vista y el hook entregan `consumo_mensual` en kg, pero la UI lo presenta como costos.
- El estado de alertas atendidas / en seguimiento se guarda en `localStorage`, no en Supabase. Eso hace que el conteo sea local al navegador.
- Existe un duplicado legado del componente `KPI` en `src/features/dashboard/pages/KPI.tsx` y `src/features/dashboard/components/KPI/KPI.tsx`, pero no se usa en las pantallas actuales.

## Fuentes auditadas

- `src/features/dashboard/pages/DashboardPage.tsx`
- `src/features/dashboard/hooks/useDashboardOperativo.ts`
- `src/features/dashboard/services/dashboardOperativoService.ts`
- `src/features/dashboard/types/operativo.ts`
- `src/features/alertas/hooks/useAlertas.ts`
- `src/features/alertas/services/alertasService.ts`
- `src/features/finanzas/pages/FinanzasPage.tsx`
- `src/features/finanzas/hooks/useFinanzas.ts`
- `src/features/finanzas/services/finanzasService.ts`
- `src/features/finanzas/components/KpiGrid.tsx`
- `src/features/finanzas/components/FlujoCharts.tsx`
- `src/features/finanzas/components/MovimientosTable.tsx`
- `src/features/finanzas/utils/finanzasCalculations.ts`
- `supabase/migrations/202605260002_dashboard_operativo_views.sql`
- `supabase/migrations/202605260003_finanzas_operativas.sql`
- `supabase/seeds/seed_demo_integral.sql`
- `supabase/seeds/seed_finanzas_qa.sql`
- `supabase/seeds/seed_phase1_qa.sql`

## Inventario: Dashboard operativo

| Elemento visible | Archivo que lo genera | Fuente de datos | Vista / consulta | Formula de calculo | Significado operativo | Real o fallback | Depende de mocks | Valido despues de 2.2-2.5 | Sergio | Clasificacion |
|---|---|---|---|---|---|---|---|---|---|---|
| Stock total MP | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/services/dashboardOperativoService.ts` | `vw_dashboard_stock_resumen.stock_total_mp` | `select * from vw_dashboard_stock_resumen` | `sum(stock_lotes_mp.cantidad_actual)` | Stock fisico total de materia prima | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Stock critico | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/services/dashboardOperativoService.ts` | `vw_dashboard_stock_resumen.stock_critico` | `select * from vw_dashboard_stock_resumen` | `count(lotes con cantidad_actual - cantidad_comprometida <= umbral_alerta)` | Lotes con riesgo real considerando reserva | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Ordenes (Pend / Proc / Fin) | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/services/dashboardOperativoService.ts` | `vw_dashboard_produccion_resumen` | `select * from vw_dashboard_produccion_resumen` | Conteo por `estado` | Estado del pipeline de produccion | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Produccion total | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/services/dashboardOperativoService.ts` | `vw_dashboard_produccion_resumen.produccion_total` | `select * from vw_dashboard_produccion_resumen` | `sum(cantidad_real)` de ordenes finalizadas | Kg producidos efectivamente | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Costo promedio produccion | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/services/dashboardOperativoService.ts` | `vw_dashboard_produccion_resumen.costo_promedio_produccion` | `select * from vw_dashboard_produccion_resumen` | `avg(costo_total_insumos / cantidad_real)` en finalizadas | Costo promedio operativo de produccion | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Merma total | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/services/dashboardOperativoService.ts` | `vw_dashboard_produccion_resumen.merma_total` | `select * from vw_dashboard_produccion_resumen` | `sum(merma_manual)` en finalizadas | Merma acumulada de produccion | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Valor inventario MP | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/services/dashboardOperativoService.ts` | `vw_dashboard_stock_resumen.valor_inventario_mp` | `select * from vw_dashboard_stock_resumen` | `sum(costo_total * (cantidad_actual / cantidad_inicial))` | Valor contable estimado de MP | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Valor inventario PT | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/services/dashboardOperativoService.ts` | `vw_dashboard_stock_resumen.valor_inventario_pt` | `select * from vw_dashboard_stock_resumen` | `sum(stock_pt.cantidad_total * costo_unitario_estimado)` | Valor del inventario de producto terminado | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Composicion de insumos (donut) | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/hooks/useDashboardOperativo.ts` | `vw_dashboard_costos_resumen.formulas` | `select formulas,consumo_mensual from vw_dashboard_costos_resumen` | Top 5 formulas/insumos por `total_pct` | Distribucion de la composicion nutricional | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Consumo mensual por insumo (barras) | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/dashboard/hooks/useDashboardOperativo.ts` | `vw_dashboard_costos_resumen.consumo_mensual` | `select formulas,consumo_mensual from vw_dashboard_costos_resumen` | Agrupa por `insumo`, suma `consumo_kg` y toma top 6 | Volumen mensual consumido por insumo | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Si | Si | Mantener |
| Evolucion costos (linea) | `src/features/dashboard/pages/DashboardPage.tsx` | `vw_dashboard_costos_resumen.consumo_mensual` | Misma vista que consumo mensual | Agrupa por `mes` y calcula `avg(consumo_kg)` | Tendencia historica mostrada como costo | Real en Supabase; fallback a `ApiService` si falla la vista | Si, solo en fallback/demo | Parcial. La serie no son costos monetarios, son kg | No coincide: el nombre promete costos, la fuente entrega consumo | Reemplazar |
| Alertas operativas (Pendientes / Criticas) | `src/features/dashboard/pages/DashboardPage.tsx` + `src/features/alertas/hooks/useAlertas.ts` + `src/features/alertas/services/alertasService.ts` | `vw_dashboard_alertas_operativas` + `localStorage` | `select * from vw_dashboard_alertas_operativas` | `pendientes = estado === 'pendiente'`; `criticas = prioridad === 'critica' && estado !== 'atendida'` | Resumen de incidencias activas | Real en Supabase; el estado visual puede venir de `localStorage` | Si, en el estado de alerta | Si para el conteo; parcial para el estado de atencion | Parcial: el conteo sirve, pero el estado no es persistente | Corregir |
| Ordenes recientes | `src/features/dashboard/pages/DashboardPage.tsx` | `ApiService.ordenes.getAll()` | No hay vista directa; depende del backend activo | Ordena por `fecha_creacion desc` y toma 5 | Ultimas OP creadas | Real si `ApiService` apunta a Supabase; fallback a mock/demo si el runtime esta en modo mock | Si, si el runtime cae en mock/demo | Si | Si | Mantener |

### Observaciones de esta seccion

- La parte operativa ya tiene una buena base real despues de las fases 2.2 a 2.5: reservas, finalizacion, stock comprometido y trazabilidad ya impactan en los KPI.
- El unico indicador que hoy no representa lo que promete es `Evolucion costos (linea)`.
- El card de alertas funciona, pero el estado de cada alerta sigue sin persistencia server-side.

## Reglas de alertas operativas

Estas reglas alimentan la vista `vw_dashboard_alertas_operativas` y, por extension, la pagina de alertas y el resumen del dashboard.

| Regla | Archivo / vista | Formula base | Significado operativo | Real o fallback | Depende de mocks | Valido despues de 2.2-2.5 | Sergio | Clasificacion |
|---|---|---|---|---|---|---|---|---|
| Stock bajo minimo | `supabase/migrations/202605260002_dashboard_operativo_views.sql` -> `vw_dashboard_alertas_operativas` | `cantidad_actual - cantidad_comprometida <= umbral_alerta` | Detecta lotes sin cobertura suficiente | Real en Supabase; fallback sintetizado desde `ApiService` | Si, en fallback | Si | Si | Mantener |
| Lote sin costo | misma vista | `costo_unitario <= 0` o inconsistente | Marca lotes que rompen valorizacion e inventario | Real en Supabase; sin fallback equivalente exacto | Si, en fallback | Si | Si | Mantener |
| Insumo sin PB | misma vista | `proteina_bruta_pct <= 0` | Detecta materias primas incompletas para formulas | Real en Supabase; sin fallback equivalente exacto | Si, en fallback | Si | Si | Mantener |
| Formula fuera de 100% | misma vista | `abs(sum(porcentaje) - 100) > tolerancia` | Formula mal cerrada | Real en Supabase; sin fallback equivalente exacto | Si, en fallback | Si | Si | Mantener |
| Merma alta | misma vista | `merma_manual > max(100, 5% de cantidad_objetivo)` | Orden con merma fuera de rango | Real en Supabase; sin fallback equivalente exacto | Si, en fallback | Si | Si | Mantener |
| Silo saturado | misma vista | `count(stock_pt por silo) >= 5` | Riesgo operativo de capacidad | Real en Supabase; sin fallback equivalente exacto | Si, en fallback | Si | Si | Mantener |
| Trazabilidad incompleta | misma vista | `orden finalizada sin eventos esperados` | Orden cerrada sin rastro completo | Real en Supabase; sin fallback equivalente exacto | Si, en fallback | Si | Si | Mantener |

### Nota importante sobre alertas

- `src/features/alertas/services/alertasService.ts` guarda el estado (`pendiente`, `en seguimiento`, `atendida`) en `localStorage` bajo `nutribalance_alertas_estado`.
- Eso significa que una alerta puede verse como atendida solo en ese navegador, y perder ese estado si se borra el storage o se cambia de equipo.
- Esa parte conviene corregir en una fase posterior, porque hoy puede dar una falsa sensacion de cierre operativo.

## Inventario: Dashboard financiero

| Elemento visible | Archivo que lo genera | Fuente de datos | Vista / consulta | Formula de calculo | Significado operativo | Real o fallback | Depende de mocks | Valido despues de 2.2-2.5 | Sergio | Clasificacion |
|---|---|---|---|---|---|---|---|---|---|---|
| Saldo actual | `src/features/finanzas/pages/FinanzasPage.tsx` + `src/features/finanzas/components/KpiGrid.tsx` + `src/features/finanzas/services/finanzasService.ts` | `vw_finanzas_kpis.saldo_actual` | `select * from vw_finanzas_kpis` | `sum(cuentas_bancarias.saldo_actual)` | Liquidez bancaria disponible | Real en Supabase; fallback a calculo operativo si la vista falla | Si, solo en fallback/demo | Si | Si | Mantener |
| Ingresos mes | idem | `vw_finanzas_kpis.ingresos_mes` | `select * from vw_finanzas_kpis` | `sum(INGRESO confirmado del mes)` | Ingresos cobrados / confirmados | Real en Supabase; fallback a estimacion operativa | Si, solo en fallback/demo | Si | Si | Mantener |
| Egresos mes | idem | `vw_finanzas_kpis.egresos_mes` | `select * from vw_finanzas_kpis` | `sum(EGRESO confirmado del mes)` | Salidas de caja del mes | Real en Supabase; fallback a estimacion operativa | Si, solo en fallback/demo | Si | Si | Mantener |
| Flujo neto | idem | `vw_finanzas_kpis.flujo_neto` | `select * from vw_finanzas_kpis` | `ingresos_mes - egresos_mes` | Resultado neto de caja | Real en Supabase; `normalizeKpis` lo recalcula si faltara | Si, solo en fallback/demo | Si | Si | Mantener |
| Margen operativo | idem | `vw_finanzas_kpis.margen_operativo` | `select * from vw_finanzas_kpis` | `(ingresos_mes - egresos_mes) / ingresos_mes * 100` | Rentabilidad operativa | Real en Supabase; `normalizeKpis` lo recalcula si faltara | Si, solo en fallback/demo | Si | Si | Mantener |
| Costo produccion | idem | `vw_finanzas_kpis.costo_produccion` | `select * from vw_finanzas_kpis` | `sum(costo_total_insumos)` de ordenes finalizadas | Costo industrial acumulado | Real en Supabase; fallback a calculo operativo desde ordenes | Si, solo en fallback/demo | Si | Si | Mantener |
| Valorizacion inventario | idem | `vw_finanzas_kpis.valorizacion_inventario` | `select * from vw_finanzas_kpis` | Valor MP + valor PT | Valor economico de inventario | Real en Supabase; fallback a calculo operativo desde stock | Si, solo en fallback/demo | Si | Si | Mantener |
| Cuentas por pagar | idem | `vw_finanzas_kpis.cuentas_por_pagar` | `select * from vw_finanzas_kpis` | `sum(comprobantes tipo compra pendientes/vencidos)` | Deuda corriente a proveedores | Real en Supabase | No directo | Si | Si | Mantener |
| Cuentas por cobrar | idem | `vw_finanzas_kpis.cuentas_por_cobrar` | `select * from vw_finanzas_kpis` | `sum(comprobantes tipo venta pendientes/vencidos)` | Cobros pendientes de clientes | Real en Supabase | No directo | Si | Si | Mantener |
| Flujo de caja mensual | `src/features/finanzas/components/FlujoCharts.tsx` + `src/features/finanzas/services/finanzasService.ts` | `vw_finanzas_reportes.payload.flujo_caja_mensual` | `select payload from vw_finanzas_reportes` | Suma mensual de `ingresos`, `egresos`, `neto` | Tendencia de caja | Real en Supabase; fallback a operacion local si falla la vista | Si, en fallback/demo | Si | Si | Mantener |
| Gastos por categoria | idem | `vw_finanzas_reportes.payload.gastos_por_categoria` | `select payload from vw_finanzas_reportes` | Suma de `EGRESO` por categoria | Mix de egresos | Real en Supabase; fallback a operacion local si falla la vista | Si, en fallback/demo | Si | Si | Mantener |
| Ingresos por categoria | idem | `vw_finanzas_reportes.payload.ingresos_por_categoria` | `select payload from vw_finanzas_reportes` | Suma de `INGRESO` por categoria | Mix de ingresos | Real en Supabase; fallback a operacion local si falla la vista | Si, en fallback/demo | Si | Si | Mantener |
| Movimientos financieros | `src/features/finanzas/components/MovimientosTable.tsx` + `src/features/finanzas/services/finanzasService.ts` | Tabla `flujo_caja_movimientos` | `select legacy_uid,fecha,tipo,origen_operativo,descripcion,monto,estado,categorias_financieras(nombre),centros_costo(nombre)` | Lista los ultimos 25 por `fecha desc` | Libro de caja detallado | Real en Supabase; si la consulta falla, el hook cae a estimacion operativa | Si, en fallback/demo | Si | Si | Mantener |
| Resumen reportes financieros | `src/features/finanzas/pages/FinanzasPage.tsx` | Longitud de arrays en `reportes` | `vw_finanzas_reportes.payload` | `length` de cada serie | Chequeo rapido de disponibilidad de reportes | Real en Supabase; o fallback si falla la vista | Si, en fallback/demo | Si | Si | Mantener |

### Observaciones de esta seccion

- El modulo financiero esta correctamente anclado a vistas Supabase reales.
- Cuando una vista falla, `useFinanzas` activa `getOperationalFallback()` y muestra `Datos financieros estimados desde operacion local`.
- Eso es util para no dejar la pantalla vacia, pero tambien puede ocultar un problema de la vista si nadie mira el banner informativo.

## Vista y soporte de dashboard

| Vista / archivo | Tablas base | Uso principal | Clasificacion |
|---|---|---|---|
| `supabase/migrations/202605260002_dashboard_operativo_views.sql` -> `vw_dashboard_stock_resumen` | `stock_lotes_mp`, `insumos`, `stock_pt`, `ordenes_produccion` | KPI de stock e inventario | Mantener |
| `supabase/migrations/202605260002_dashboard_operativo_views.sql` -> `vw_dashboard_produccion_resumen` | `ordenes_produccion`, `trazabilidad_eventos` | KPI de produccion | Mantener |
| `supabase/migrations/202605260002_dashboard_operativo_views.sql` -> `vw_dashboard_costos_resumen` | `formulas`, `formula_ingredientes`, `ordenes_produccion`, `orden_consumo_lotes`, `insumos` | Composicion, consumo mensual y proteina promedio | Mantener |
| `supabase/migrations/202605260002_dashboard_operativo_views.sql` -> `vw_dashboard_alertas_operativas` | `stock_lotes_mp`, `insumos`, `ordenes_produccion`, `trazabilidad_eventos`, `silos`, `formulas` | Alertas del dashboard y pagina de alertas | Mantener |
| `supabase/migrations/202605260002_dashboard_operativo_views.sql` -> `vw_dashboard_trazabilidad` | `trazabilidad_eventos`, `ordenes_produccion`, `stock_lotes_mp`, `stock_pt` | Trazabilidad visual | Mantener |
| `supabase/migrations/202605260003_finanzas_operativas.sql` -> `vw_finanzas_kpis` | `flujo_caja_movimientos`, `comprobantes`, `cuentas_bancarias`, `ordenes_produccion`, `stock_lotes_mp`, `stock_pt` | KPI financieros | Mantener |
| `supabase/migrations/202605260003_finanzas_operativas.sql` -> `vw_finanzas_reportes` | `flujo_caja_movimientos`, `ordenes_produccion` | Reportes financieros | Mantener |

## Legado o no usado

| Elemento | Archivo | Estado | Riesgo | Clasificacion |
|---|---|---|---|---|
| KPI generico duplicado | `src/features/dashboard/pages/KPI.tsx`, `src/features/dashboard/components/KPI/KPI.tsx`, `src/features/dashboard/components/KPI/KPI.types.ts` | No se importa desde `DashboardPage` ni desde ningun flujo visible | Duplica responsabilidad y puede confundir mantenimiento | Eliminar |

## Riesgos operativos detectados

1. `Evolucion costos (linea)` esta mal nombrado: la serie no mide costos monetarios.
2. Las alertas atendidas / en seguimiento dependen de `localStorage`.
3. `dashboardOperativoService` y `useFinanzas` conservan fallback para no romper la UI. Eso es correcto como resiliencia, pero puede ocultar fallas reales si no se monitorea el banner o la consola.
4. Las semillas demo / QA limpian datos de tablas que alimentan dashboard y finanzas:
   - `supabase/seeds/seed_demo_integral.sql` hace `delete from public.formula_ingredientes`, `delete from public.orden_consumo_lotes` y `delete from public.flujo_caja_movimientos where legacy_uid like 'demo-mov-%'`.
   - `supabase/seeds/seed_finanzas_qa.sql` hace `delete from public.flujo_caja_movimientos`.
   - `supabase/seeds/seed_phase1_qa.sql` hace `delete from public.formula_ingredientes` y `delete from public.orden_consumo_lotes`.
5. Si esos seeds se ejecutaran por error sobre una base real, el dashboard financiero y parte de los KPI operativos podrian quedar vacios o reconstruidos con datos de prueba.

## Conclusiones

- **Mantener**: stock, produccion, inventario, composicion de formulas, reportes financieros y movimientos financieros.
- **Corregir**: el card de alertas por su estado local-only, y la experiencia de fallback para que no oculte problemas de origen.
- **Reemplazar**: `Evolucion costos (linea)` por una serie monetaria real o renombrar la visualizacion si en realidad es consumo.
- **Eliminar**: el componente `KPI` duplicado y no usado.

## Veredicto previo a Fase 3

El dashboard ya esta bastante alineado con los datos reales despues de las fases 2.2 a 2.5, pero no esta listo para considerarse completamente cerrado:

- Hay una visualizacion mal definida (`Evolucion costos`).
- El estado de alertas sigue siendo local al navegador.
- Existen fallbacks que pueden ocultar fallas de Supabase si no se vigilan.

Con eso, la base es buena para seguir, pero conviene corregir esos puntos antes de tocar KPIs o dashboards de forma mas amplia.
