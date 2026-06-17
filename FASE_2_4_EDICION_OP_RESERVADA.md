# FASE 2.4 - Edición segura de OP con stock reservado

## Problema técnico

Antes de esta fase, una OP reservada podía editarse sin garantizar coherencia entre:

- `ordenes_produccion`
- `orden_consumo_lotes`
- `stock_lotes_mp.cantidad_comprometida`
- `stock_movimientos`

Eso abría dos riesgos:

- dejar stock comprometido viejo después de cambiar cantidad o fórmula;
- recalcular una nueva reserva sin liberar la anterior, generando desfasaje o doble compromiso.

## Regla funcional aplicada

Se aplicó esta regla:

- si la OP está `PENDIENTE` o `EN PROCESO`, el detalle FIFO representa reserva;
- si se edita cantidad, fórmula o detalle, se libera la reserva anterior y se recalcula la nueva;
- si no alcanza stock para la nueva versión, la edición falla y todo vuelve a como estaba;
- si la OP está `FINALIZADA`, no se permite editar;
- si la OP está `ANULADA`, no debe quedar stock comprometido.

## Decisión técnica

Se resolvió con una RPC transaccional en Supabase para evitar escrituras parciales desde el frontend.

Flujo:

1. bloquear la orden;
2. liberar la reserva anterior;
3. recalcular el detalle FIFO o usar el detalle nuevo enviado;
4. validar disponibilidad contra otras OP reservadas;
5. reservar el nuevo stock;
6. actualizar la cabecera de la OP;
7. registrar trazabilidad.

Si algo falla, la transacción revierte completa.

## Archivos modificados

- [`supabase/migrations/202606080002_reserva_stock_op.sql`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/supabase/migrations/202606080002_reserva_stock_op.sql)
- [`supabase/migrations/202606080003_edicion_reserva_op.sql`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/supabase/migrations/202606080003_edicion_reserva_op.sql)
- [`src/infrastructure/api/supabase/services/supabaseOrdenService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/supabase/services/supabaseOrdenService.ts)
- [`src/infrastructure/api/mock/services/mockMateriaPrimaService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/mock/services/mockMateriaPrimaService.ts)
- [`src/infrastructure/api/mock/services/mockOrdenService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/mock/services/mockOrdenService.ts)
- [`src/infrastructure/api/supabase/services/supabaseOrdenService.reserva.test.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/supabase/services/supabaseOrdenService.reserva.test.ts)

## RPCs y migration

### Nuevas funciones

- `crear_orden_produccion_con_reserva`
- `liberar_reserva_orden_produccion`
- `actualizar_orden_produccion_con_reserva`

### Qué hacen

- `crear_orden_produccion_con_reserva`: crea la OP y reserva el stock necesario.
- `liberar_reserva_orden_produccion`: libera el stock comprometido al anular.
- `actualizar_orden_produccion_con_reserva`: libera la reserva vieja, recalcula el detalle y reserva la nueva versión de forma atómica.

## Cómo se evita inconsistencia

- La reserva vieja se libera antes de reservar la nueva.
- El recálculo usa stock ajustado por la reserva liberada para no falsear disponibilidad.
- Si la nueva reserva falla, la transacción revierte y no quedan datos intermedios.
- El frontend ya no hace escrituras separadas para edición de OP con reserva.

## Cómo se evita doble descuento

- La reserva vive en `cantidad_comprometida`.
- El consumo físico real sigue ocurriendo al finalizar mediante `stock_movimientos`.
- La edición de una OP reservada no inserta movimientos físicos.
- Finalizar sigue consumiendo una sola vez y liberando el compromiso.

## Cómo probar

### Crear OP con reserva

1. Crear una OP pendiente desde programación.
2. Confirmar que la orden queda en `ordenes_produccion`.
3. Confirmar que el detalle queda en `orden_consumo_lotes`.
4. Confirmar que `cantidad_comprometida` sube en `stock_lotes_mp`.

### Editar aumentando cantidad

1. Abrir una OP pendiente o en proceso.
2. Aumentar la cantidad objetivo.
3. Confirmar que la edición recalcula la reserva y no deja el compromiso viejo.

### Editar reduciendo cantidad

1. Abrir una OP reservada.
2. Bajar la cantidad objetivo.
3. Confirmar que la nueva reserva es menor y que el excedente queda liberado.

### Sin stock suficiente

1. Intentar editar una OP a una cantidad superior a la disponibilidad real.
2. Confirmar que la operación falla.
3. Confirmar que no cambia la reserva previa.

### OP finalizada

1. Intentar editar una OP finalizada.
2. Confirmar que el sistema lo bloquea.

### Anulación

1. Anular una OP pendiente o en proceso.
2. Confirmar que la reserva se libera.

## Pruebas ejecutadas

- `npm run lint`
- `npm run build`
- `npx vitest run src/infrastructure/api/supabase/services/supabaseOrdenService.reserva.test.ts src/infrastructure/api/supabase/services/supabaseOrdenService.finalizacion.test.ts src/features/ordenes/services/ordenService.permissions.test.ts`

## Pendientes

- No se tocó RLS ni permisos.
- No se modificó la finalización física salvo compatibilidad con la reserva ya existente.
- La UI no se rediseñó; solo quedó protegida por servicio/RPC.

## Resultado

La edición de una OP reservada ya no puede dejar stock comprometido desfasado ni generar dobles reservas invisibles. La coherencia entre cabecera, detalle, reserva y consumo físico quedó alineada para Supabase real y para el modo mock/demo.
