# FASE 3.1 - Dashboard operativo real

## Problema original

El dashboard mostraba métricas útiles, pero mezclaba conceptos:

- `Stock total MP` no separaba físico, comprometido y disponible.
- El gráfico `Evolución costos` mostraba consumo en kg, no costos monetarios.
- Parte de las alertas se presentaba con texto demasiado global para un estado que en realidad vive en `localStorage`.
- Había KPI legacy duplicado sin uso real.

## Objetivo de la corrección

Dejar el dashboard alineado con la operación real estabilizada en fases 2.2 a 2.5:

- stock físico
- stock comprometido
- stock disponible
- OP pendientes / en proceso / finalizadas
- stock PT total
- valor PT solo cuando hay base de costo confiable

## KPIs corregidos

### Materia prima

- `Stock físico MP`
  - Fuente: `stock_lotes_mp.cantidad_actual`
  - Fórmula: suma de cantidades actuales de lotes activos
- `Stock comprometido MP`
  - Fuente: `stock_lotes_mp.cantidad_comprometida`
  - Fórmula: suma de cantidades comprometidas de lotes activos
- `Stock disponible MP`
  - Fuente: cálculo sobre `stock_lotes_mp`
  - Fórmula: `stock físico - stock comprometido`
- `Lotes críticos`
  - Fuente: `vw_dashboard_stock_resumen.stock_critico`
  - Fórmula: lotes con disponible menor o igual al umbral del insumo

### Producción

- `OP pendientes`
  - Fuente: `vw_dashboard_produccion_resumen.ordenes_pendientes`
- `OP en proceso`
  - Fuente: `vw_dashboard_produccion_resumen.ordenes_en_proceso`
- `OP finalizadas`
  - Fuente: `vw_dashboard_produccion_resumen.ordenes_finalizadas`
- `Producción total`
  - Fuente: `vw_dashboard_produccion_resumen.produccion_total`
  - Fórmula: suma de `cantidad_real` de ordenes finalizadas
- `Merma total`
  - Fuente: `vw_dashboard_produccion_resumen.merma_total`
  - Fórmula: suma de `merma_manual`
- `Costo promedio producción`
  - Fuente: `vw_dashboard_produccion_resumen.costo_promedio_produccion`
  - Fórmula: promedio de `costo_total_insumos / cantidad_real`

### Producto terminado

- `Stock PT total`
  - Fuente: `vw_dashboard_stock_resumen.stock_total_pt`
  - Fórmula: suma de `stock_pt.cantidad_total`
- `Valor inventario PT`
  - Fuente: `vw_dashboard_stock_resumen.valor_inventario_pt`
  - Fórmula: valor estimado desde órdenes finalizadas con costo disponible
  - Nota: si no hay base confiable, la UI lo muestra como `Sin costo confiable`

## Gráficos corregidos

### Antes

- `Evolución costos (línea)` usaba `consumo_mensual` en kg.

### Ahora

- `Consumo mensual MP (kg)`
  - Fuente: `vw_dashboard_costos_resumen.consumo_mensual`
  - Fórmula: suma mensual de `consumo_kg`
  - Etiquetas corregidas para que no se interprete como costo monetario

### Se mantienen

- `Composición de insumos (donut)`
  - Fuente: `vw_dashboard_costos_resumen.formulas`
- `Consumo mensual por insumo (barras)`
  - Fuente: `vw_dashboard_costos_resumen.consumo_mensual`

## Alertas

- Se mantuvo la lectura desde `vw_dashboard_alertas_operativas`.
- Se aclaró en la UI que el estado de seguimiento vive en el navegador y no es auditable en Supabase todavía.
- No se migró persistencia de alertas en esta fase.

## Archivos modificados

- `src/features/dashboard/pages/DashboardPage.tsx`
- `src/features/dashboard/services/dashboardOperativoService.ts`
- `src/features/dashboard/services/dashboardOperativoService.test.ts`
- `src/features/dashboard/hooks/useDashboardOperativo.ts`
- `src/features/dashboard/types/operativo.ts`
- `src/features/dashboard/pages/KPI.tsx` eliminado
- `src/features/dashboard/components/KPI/KPI.tsx` eliminado
- `src/features/dashboard/components/KPI/KPI.types.ts` eliminado
- `src/features/dashboard/components/KPI/index.ts` eliminado

## Fuente de datos usada

### Supabase

- `stock_lotes_mp`
- `stock_pt`
- `ordenes_produccion`
- `orden_consumo_lotes`
- `formulas`
- `formula_ingredientes`
- `insumos`
- `trazabilidad_eventos`

### Vistas

- `vw_dashboard_stock_resumen`
- `vw_dashboard_produccion_resumen`
- `vw_dashboard_costos_resumen`
- `vw_dashboard_alertas_operativas`
- `vw_dashboard_trazabilidad`

### Fallbacks

- `ApiService.stockMP.getAllLotes()`
- `ApiService.stockPT.getAll()`
- `ApiService.ordenes.getAll()`
- `ApiService.formulas.findAll()`

## Validación realizada

- `npm run lint` OK
- `npm run build` OK
- `npm run test -- src/features/dashboard/services/dashboardOperativoService.test.ts` OK

## Qué quedó fuera de alcance

- No se migraron alertas persistidas a Supabase.
- No se tocó finanzas.
- No se tocó auth.
- No se tocaron clientes.
- No se tocó RLS.
- No se rediseñó la UI.
- No se creó un KPI monetario nuevo para costos si no existe una base clara fuera de la vista ya disponible.

## Pendientes para Fase 3.2

- Revisar si el gráfico `Consumo mensual por insumo` conviene renombrarlo o separarlo por período.
- Definir si las alertas deben pasar de `localStorage` a Supabase.
- Si Sergio quiere KPIs más ejecutivos, sumar una lectura más clara de rotación / cobertura por familia de producto.

## Veredicto

El dashboard operativo ya muestra métricas más honestas y alineadas con la operación real:

- stock físico
- stock comprometido
- stock disponible
- OP activas
- stock PT
- consumo mensual real en kg

La mayor corrección fue dejar de presentar consumo como costo y separar el stock MP en sus tres estados operativos.
