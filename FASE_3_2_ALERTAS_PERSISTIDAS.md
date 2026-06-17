# FASE 3.2 - Alertas operativas persistidas en Supabase

## Problema original

El estado de las alertas operativas vivía en `localStorage`.

Consecuencias:

- cada navegador mostraba un estado distinto
- no existía auditoría real
- el seguimiento se podía perder al limpiar el storage
- el dashboard podía mostrar estados locales como si fueran globales

## Modelo implementado

Se mantuvo la generación de alertas operativas desde la vista del dashboard, pero el estado pasó a persistirse en Supabase.

### Flujo final

1. `dashboardOperativoService.getAlertasOperativas()` sigue calculando las alertas desde las vistas operativas.
2. `alertasService.getAlertasOperativas()` cruza cada alerta calculada con su estado persistido.
3. `alertasService.setEstadoAlerta()` guarda el nuevo estado en Supabase con `upsert`.
4. La UI de Alertas y el resumen del Dashboard leen ese estado persistido, no `localStorage`, en modo real.

## Tabla creada

### `public.alertas_estado`

Campos:

- `id uuid primary key default gen_random_uuid()`
- `alerta_key text not null unique`
- `estado text not null default 'PENDIENTE'`
- `comentario text`
- `usuario_id uuid`
- `origen text`
- `prioridad text`
- `ultima_actualizacion timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Restricción:

- `estado` solo admite `PENDIENTE`, `EN_SEGUIMIENTO`, `ATENDIDA`, `DESCARTADA`

## Cómo se genera `alerta_key`

La clave estable de cada alerta es el `alerta_id` calculado por `vw_dashboard_alertas_operativas`.

Ejemplos:

- `stock_bajo_minimo:<uuid_del_lote>`
- `lote_sin_costo:<uuid_del_lote>`
- `insumo_sin_pb:<uuid_del_insumo>`
- `formula_fuera_100:<uuid_de_formula>`
- `merma_alta:<uuid_de_orden>`
- `silo_saturado:<id_del_silo>`
- `trazabilidad_incompleta:<uuid_de_orden>`

Esa clave permite cruzar una alerta calculada con su estado persistido sin depender del navegador.

## Mapeo de estados

### UI

- `pendiente`
- `en seguimiento`
- `atendida`
- `descartada`

### Base de datos

- `PENDIENTE`
- `EN_SEGUIMIENTO`
- `ATENDIDA`
- `DESCARTADA`

El servicio traduce en ambos sentidos para no romper la UI actual.

## Archivos modificados

- `src/features/alertas/services/alertasService.ts`
- `src/features/alertas/services/alertasService.test.ts`
- `src/features/alertas/hooks/useAlertas.ts`
- `src/features/alertas/pages/AlertasPage.tsx`
- `src/features/alertas/types/alerta.ts`
- `supabase/migrations/202606080005_alertas_estado_persistido.sql`

## Qué cambió en la UI

- No se rediseñó nada.
- Los botones actuales siguen funcionando.
- El estado ahora se guarda en Supabase en modo real.
- Se agregó soporte visible para `Descartada` en filtros y etiquetas.
- Si falla la persistencia, la UI muestra error en vez de simular que quedó guardado.

## Compatibilidad mock/demo

- En `VITE_USE_MOCKS=true`, el estado de alertas sigue funcionando con `localStorage`.
- Eso mantiene el demo local sin tocar el comportamiento esperado del modo real.

## Dashboard

- El dashboard sigue consumiendo `useAlertas()`.
- Por eso, los conteos de pendientes / críticas / en seguimiento ahora salen del estado persistido en Supabase cuando el entorno está en modo real.
- Ya no dependen de `localStorage` como fuente global.

## Cómo probar en Supabase real

1. Levantar la app con `VITE_USE_MOCKS=false`.
2. Crear o cargar alertas operativas desde la vista.
3. Marcar una alerta como `En seguimiento` o `Atendida`.
4. Refrescar navegador.
5. Confirmar que el estado se mantiene.
6. Verificar la fila en la tabla `alertas_estado`.

## Cómo probar en mock

1. Levantar la app con `VITE_USE_MOCKS=true`.
2. Abrir la página de alertas.
3. Cambiar el estado de una alerta.
4. Refrescar navegador.
5. Confirmar que el estado se mantiene en demo.

## Fuera de alcance

- No se tocó RLS.
- No se tocó auth real.
- No se rediseñó la pantalla.
- No se inventaron nuevas alertas.
- No se cambió la lógica de cálculo de alertas operativas.

## Pendientes

- Asociar `usuario_id` a un usuario real cuando exista auth operativa.
- Definir si el comentario de seguimiento tendrá una UI de edición explícita.
- Revisar RLS cuando llegue la fase correspondiente.

## Validación realizada

- `npm run lint` OK
- `npm run build` OK
- `npm run test -- src/features/alertas/services/alertasService.test.ts src/features/dashboard/services/dashboardOperativoService.test.ts` OK

## Veredicto

Las alertas operativas ya no dependen de `localStorage` en modo real.
El estado queda persistido en Supabase, es compartido entre navegadores y es auditable.
