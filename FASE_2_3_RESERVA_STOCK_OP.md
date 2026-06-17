# FASE 2.3 - Reserva de stock para OP pendientes

## Estado actual

El sistema ya separa correctamente:

- `stock_lotes_mp.cantidad_actual`: stock físico del lote.
- `stock_lotes_mp.cantidad_comprometida`: reserva/compromiso para OP pendientes o en proceso.
- `stock_movimientos`: consumo físico real al finalizar la OP.
- `orden_consumo_lotes`: detalle FIFO de consumo planificado por orden.

La reserva ya no queda solo en memoria o en el cálculo del frontend: ahora se persiste en Supabase.

## Decisión técnica

Se adoptó la solución mínima compatible con el esquema actual:

- Reutilizar `orden_consumo_lotes` como detalle planificado de la OP.
- Reservar materia prima incrementando `cantidad_comprometida` sobre `stock_lotes_mp`.
- Liberar reserva al anular/cancelar una OP.
- Mantener el consumo físico real únicamente al finalizar la orden.

No se creó una tabla nueva.

## Archivos modificados

- [`supabase/migrations/202606080002_reserva_stock_op.sql`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/supabase/migrations/202606080002_reserva_stock_op.sql)
- [`src/infrastructure/api/supabase/services/supabaseOrdenService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/supabase/services/supabaseOrdenService.ts)
- [`src/infrastructure/api/mock/services/mockMateriaPrimaService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/mock/services/mockMateriaPrimaService.ts)
- [`src/infrastructure/api/mock/services/mockOrdenService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/mock/services/mockOrdenService.ts)

## Modelo detectado

### Qué representa cada tabla

- `ordenes_produccion`: cabecera de la OP.
- `orden_consumo_lotes`: consumo FIFO planificado por lote.
- `stock_lotes_mp`: stock físico y stock comprometido.
- `stock_movimientos`: ledger de entradas/salidas/ajustes reales.

### Cómo se calcula la disponibilidad

`stock disponible = stock físico - stock comprometido`

Ese cálculo ya existe en el frontend y ahora también queda protegido en el flujo de creación real de OP.

## Qué hace el flujo real ahora

### Crear OP pendiente

- Se calcula el FIFO con el stock disponible.
- Se crea la orden y su detalle.
- Se llama a `crear_orden_produccion_con_reserva`.
- La reserva queda persistida en `cantidad_comprometida`.
- Se registra trazabilidad `RESERVA_MP`.

### Cancelar / anular OP

- Se llama a `liberar_reserva_orden_produccion`.
- Se descuenta la reserva de `cantidad_comprometida`.
- Luego la orden queda marcada como anulada/de baja lógica.

### Finalizar OP

- Ya existía `finalizar_orden_produccion`.
- Ese RPC inserta `stock_movimientos` tipo `SALIDA`.
- Después libera el compromiso de los lotes consumidos.

Con esto se evita el doble descuento:

- La reserva bloquea disponibilidad antes de empezar.
- La finalización convierte la reserva en consumo real.
- No se descuenta dos veces ni en reserva ni en cierre.

## Qué pasa en mock/demo

El modo mock ahora también refleja la misma lógica:

- al crear OP, reserva stock en memoria;
- al finalizar, consume stock reservado y reduce stock físico;
- al cancelar, libera la reserva.

Eso evita que el demo siga “pareciendo” que guarda sin persistir ni bloquear stock.

## Cómo probar en Supabase real

1. Ejecutar la app con `VITE_USE_MOCKS=false`.
2. Crear una OP pendiente desde programación.
3. Verificar en Supabase Table Editor:
   - existe la fila en `ordenes_produccion`;
   - existen filas en `orden_consumo_lotes`;
   - `stock_lotes_mp.cantidad_comprometida` aumentó.
4. Refrescar el navegador y confirmar que la OP sigue visible.
5. Cancelar/anular la OP y verificar que la reserva se libera.
6. Finalizar la OP y confirmar que:
   - se insertó `stock_movimientos` con `SALIDA`;
   - la reserva se liberó;
   - no hubo doble descuento.

## Cómo probar stock insuficiente

1. Crear una OP que consuma más stock disponible del que queda.
2. Confirmar que la creación falla con un error claro de stock insuficiente.
3. Verificar que no se inserta la OP ni su detalle.

## Cómo probar varias OP contra el mismo insumo

1. Crear una OP pendiente que consuma parte del lote.
2. Confirmar que `cantidad_comprometida` sube y la disponibilidad baja.
3. Crear una segunda OP del mismo insumo.
4. Verificar que el sistema calcula el stock disponible real restante.

## Checklist de validación

- [x] `npm run lint`
- [x] `npm run build`
- [x] `npx vitest run src/features/ordenes/utils/productionFlow.test.ts src/infrastructure/api/supabase/services/supabaseOrdenService.finalizacion.test.ts src/features/ordenes/services/ordenService.permissions.test.ts`

## Riesgos y pendientes

- La edición de `detalle_insumos` en órdenes ya creadas no quedó endurecida en esta fase; el flujo principal cubierto aquí es crear, cancelar y finalizar.
- No se tocaron RLS ni permisos.
- No se agregaron llaves reales ni cambios de UI.

## Conclusión

La información ya no depende sólo del estado local para la reserva de materia prima:

- lo que se programa queda persistido;
- lo que se reserva queda bloqueado;
- lo que se finaliza se consume una sola vez.

Esto deja el camino listo para la siguiente etapa funcional sin seguir arrastrando el problema de “se borra de un día al otro”.
