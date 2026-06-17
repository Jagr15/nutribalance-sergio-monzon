# FASE 2.5 - Validación funcional integral de órdenes y stock

## Alcance validado

Se revisó el flujo extremo a extremo:

- Materia prima
- Fórmulas
- Programación de OP
- Reserva de stock
- Edición de OP
- Anulación de OP
- Finalización de OP
- Producto terminado

También se revisaron las pantallas relacionadas:

- Materia Prima
- Fórmulas
- Productos
- Órdenes de Producción
- Dashboard operativo

## A) Casos ejecutados

### Caso A - Crear OP pendiente

Verificación:

- orden creada
- reserva creada
- stock disponible reducido
- stock físico intacto

### Caso B - Editar OP aumentando cantidad

Verificación:

- recalcula reserva
- actualiza FIFO
- no duplica reservas

### Caso C - Editar OP disminuyendo cantidad

Verificación:

- libera excedente
- disponibilidad aumenta correctamente

### Caso D - Programar OP sin stock suficiente

Verificación:

- bloqueo correcto
- no deja registros parciales

### Caso E - Anular OP

Verificación:

- libera reserva
- no deja comprometido residual

### Caso F - Finalizar OP

Verificación:

- elimina compromiso
- genera consumo real
- genera producto terminado
- no duplica movimientos

### Caso G - Dos OP con el mismo insumo

Verificación:

- disponibilidad considera reservas previas
- no permite sobreasignación

## B) Resultado de cada caso

- Caso A: OK
- Caso B: OK
- Caso C: OK
- Caso D: OK
- Caso E: OK
- Caso F: OK
- Caso G: OK

## C) Bugs encontrados

### Bug encontrado

La anulación de OP no era atómica: primero liberaba la reserva y después marcaba la orden como anulada.

Riesgo:

- si la segunda escritura fallaba, la OP podía quedar activa sin reserva;
- si la lectura posterior fallaba, quedaba una inconsistencia operativa.

## D) Bugs corregidos

### Corrección aplicada

Se agregó la RPC atómica `anular_orden_produccion_con_liberacion` para que la liberación de reserva y la anulación queden dentro de la misma transacción.

Archivos involucrados:

- [`supabase/migrations/202606080004_anulacion_segura_op.sql`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/supabase/migrations/202606080004_anulacion_segura_op.sql)
- [`src/infrastructure/api/supabase/services/supabaseOrdenService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/supabase/services/supabaseOrdenService.ts)

## E) Bugs pendientes

- No se detectaron bugs funcionales críticos adicionales en el flujo de órdenes/stock.
- La validación se apoyó en revisión de código y tests; no se ejecutó una carga masiva real sobre un entorno productivo.

## F) Riesgos operativos

- La solución depende de aplicar las migrations nuevas antes del despliegue.
- Si se saltea una migration, la UI seguirá funcionando en parte, pero el flujo de reserva/edición/anulación puede perder atomicidad.
- No se modificó RLS ni permisos.

## G) Recomendación antes de pasar a Dashboard

- Aplicar todas las migrations de la cadena 2.3, 2.4 y 2.5 en Supabase real.
- Verificar en Table Editor una secuencia completa:
  - crear OP
  - editar OP
  - anular OP
  - crear otra OP
  - finalizar OP
- Confirmar que `cantidad_comprometida`, `orden_consumo_lotes`, `stock_movimientos` y `stock_pt` quedan coherentes.

## H) Veredicto final

**APTO PARA SIGUIENTE FASE**

Motivo:

- el flujo completo de órdenes y stock quedó consistente;
- el único bug real detectado se corrigió;
- lint, build y tests relacionados pasan correctamente;
- no quedaron reservas huérfanas ni dobles descuentos observables en la lógica validada.

## Validación técnica ejecutada

- `npm run lint`
- `npm run build`
- `npx vitest run src/infrastructure/api/supabase/services/supabaseOrdenService.reserva.test.ts src/infrastructure/api/supabase/services/supabaseOrdenService.finalizacion.test.ts src/features/ordenes/utils/productionFlow.test.ts src/features/dashboard/services/dashboardOperativoService.test.ts src/features/ordenes/services/ordenService.permissions.test.ts`

## Resultado resumido

El circuito de producción quedó estable para avanzar a Dashboard y KPIs, con la advertencia operativa de aplicar las migrations pendientes en el entorno Supabase real antes de mover a producción.
