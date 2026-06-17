# FASE 2.2 - Programación real de producción

## Problema original

La pantalla de productos/programación mostraba un flujo visual con SweetAlert, pero no registraba ninguna orden de producción real. El usuario veía una “programación preparada”, aunque no se insertaba nada en Supabase.

## Qué se cambió

La programación pasó a crear una orden de producción real en estado `PENDIENTE` usando el servicio existente de órdenes.

## Archivos modificados

- [`src/features/productos/pages/ProductosPage.tsx`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/features/productos/pages/ProductosPage.tsx)
- [`FASE_2_2_PROGRAMACION_PRODUCCION_REAL.md`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/FASE_2_2_PROGRAMACION_PRODUCCION_REAL.md)

## Cómo se conectó la programación con las órdenes

- La pantalla de productos sigue cargando `stock_pt` y fórmulas.
- Al abrir “Programar producción”, la UI ahora:
  - toma el producto seleccionado
  - resuelve la fórmula asociada por nombre
  - genera un lote de OP
  - toma la fecha elegida como fecha de programación
  - usa un usuario responsable válido del repo
  - llama a `useOrdenService.create(...)`
- El servicio de órdenes delega en `ApiService.ordenes.create(...)`, así que en modo real usa Supabase y en demo usa mock.

Referencias técnicas:

- [`src/features/productos/pages/ProductosPage.tsx`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/features/productos/pages/ProductosPage.tsx#L126)
- [`src/features/ordenes/services/ordenService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/features/ordenes/services/ordenService.ts#L34)
- [`src/infrastructure/api/supabase/services/supabaseOrdenService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/supabase/services/supabaseOrdenService.ts#L241)

## Qué datos se guardan

La OP se guarda con:

- `lote`
- `id_formula`
- `nombre_producto`
- `version_formula`
- `cantidad_objetivo`
- `estado: PENDIENTE`
- `fecha_creacion`
- `usuario_responsable`
- `id_silo` cuando el producto terminado tiene silo asociado
- `destino_silo` cuando existe el silo asociado
- `detalle_insumos` planificado por FIFO, generado por el servicio real
- `costo_total_insumos` calculado por el backend si no se envía un valor explícito

Importante:

- No se agregó un campo nuevo para fecha programada porque el esquema actual no lo tiene.
- La fecha elegida en el modal se guarda usando `fecha_creacion` como el campo más cercano disponible.
- No se implementó reserva ni descuento de stock de materia prima.

## Cómo funciona en Supabase real

- El frontend llama a `useOrdenService.create`.
- El adapter real usa [`supabaseOrdenService.create`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/supabase/services/supabaseOrdenService.ts#L241) dentro del backend de aplicación.
- Ese servicio:
  - valida que la fórmula exista
  - calcula FIFO con stock disponible
  - inserta la fila en `ordenes_produccion`
  - inserta el detalle en `orden_consumo_lotes`
  - deja la orden en `PENDIENTE`

Verificación en Supabase:

- revisar `public.ordenes_produccion`
- revisar `public.orden_consumo_lotes`
- confirmar que la orden quedó con `estado = 'PENDIENTE'`

## Cómo probar en modo Supabase real

1. Configurar:

```env
VITE_USE_MOCKS=false
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_PUBLICA
```

2. Abrir la pantalla de productos/stock PT.
3. Elegir un producto con fórmula asociada.
4. Abrir “Programar producción”.
5. Elegir cantidad y fecha.
6. Confirmar.
7. Verificar que la consola muestre el backend real con `[nutribalance/runtime]`.
8. Revisar en Supabase que exista la nueva fila en `ordenes_produccion`.
9. Revisar que exista el detalle en `orden_consumo_lotes`.
10. Confirmar que la OP quedó en estado `PENDIENTE`.

## Cómo probar en modo mock

1. Configurar `VITE_USE_MOCKS=true`.
2. Abrir la misma pantalla.
3. Repetir la programación.
4. Confirmar que la UI responde con éxito.
5. Verificar que el backend activo sea `mock` en consola.
6. Recordar que el dato vive solo en memoria de la sesión mock y no debe tomarse como persistencia real.

## Qué quedó fuera de alcance

- Reserva de stock de materia prima para OP pendiente.
- Descuento o compromiso real de stock al programar.
- Finalización/cierre de orden.
- Cambios en auth/session.
- Cambios en alertas.
- Cambios en clientes.
- Cambios en RLS/permisos.
- Rediseño de la pantalla.

## Pendiente para la siguiente fase

La siguiente mejora natural es reservar o comprometer stock de materia prima cuando se crea la OP pendiente, para evitar sobreprogramación y reflejar disponibilidad real.

## Validaciones

- `npm run lint` OK.
- `npm run build` OK.
- Tests de órdenes relacionados ejecutados y OK:
  - `src/infrastructure/api/supabase/services/supabaseOrdenService.finalizacion.test.ts`
  - `src/features/ordenes/utils/productionFlow.test.ts`
  - `src/features/ordenes/services/ordenService.permissions.test.ts`

## Conclusión

La programación dejó de ser solo visual y ahora genera una OP real pendiente en Supabase cuando el entorno está en modo real.  
La lógica de reserva/descuento de stock sigue fuera de esta fase, tal como se pidió.
