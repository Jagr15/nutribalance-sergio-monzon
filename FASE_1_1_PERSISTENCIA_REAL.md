# FASE 1.1 - Validación técnica de persistencia real

## Estado actual

- La app tiene arquitectura híbrida: el selector central está en `src/infrastructure/api/index.ts`.
- El modo real depende de `VITE_USE_MOCKS=false` y de tener `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- Si `VITE_USE_MOCKS` queda como `true` o no se define explícitamente, la app puede caer en mocks en desarrollo.
- Se agregó un guard de runtime en `src/infrastructure/api/runtimeConfig.ts` para impedir que producción arranque en modo mock por error.
- `src/infrastructure/api/supabase/client.ts` ahora depende del mismo guard central, evitando divergencias entre el cliente y el selector de servicios.

## Evidencia por archivo

### Conexión y modo API

- `src/infrastructure/api/index.ts:1-6` selecciona `supabaseAdapter` o `mockAdapter` según `runtimeConfig.mode`.
- `src/infrastructure/api/runtimeConfig.ts:1-47` valida `VITE_USE_MOCKS`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- `src/infrastructure/api/supabase/client.ts:1-15` crea el cliente real solo cuando `runtimeConfig.mode === 'supabase'`.
- `.env:1` contiene `VITE_USE_MOCKS=true`.
- `.env.example:1-3` deja `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` vacíos y también usa `VITE_USE_MOCKS=true`.
- `vercel.json:1-8` no define variables de entorno ni bloquea el modo mock.

### Flujos no persistentes o de baja confiabilidad

- `src/features/clientes/pages/ClientesPage.tsx:58-201` usa arrays hardcodeados y estado React; no hay inserción real en Supabase.
- `src/features/alertas/services/alertasService.ts:4-53` persiste el estado en `localStorage` con la clave `nutribalance_alertas_estado`.
- `src/features/auth/session.ts:10-75` usa `localStorage` y credenciales demo en memoria; no hay Supabase Auth.
- `src/features/auth/pages/LoginPage.tsx:30-55` sigue el flujo demo y guarda sesión local.
- `src/features/productos/pages/ProductosPage.tsx:114-221` la “programación” es un modal visual con Swal; no hace `insert` ni `update`.
- `src/features/finanzas/hooks/useFinanzas.ts:34-74` puede aplicar fallback a datos operativos locales si alguna consulta falla o si está en modo mock.

### Seeds peligrosos

- `supabase/seeds/seed_phase1_qa.sql:171-174` borra `public.formula_ingredientes` para fórmulas seeded.
- `supabase/seeds/seed_phase1_qa.sql:274` borra `public.orden_consumo_lotes`.
- `supabase/seeds/seed_finanzas_qa.sql:124-125` borra `public.flujo_caja_movimientos` con prefijo `mov-fin-%`.
- `supabase/seeds/seed_demo_integral.sql:239`, `:322` y `:475` también limpian tablas relacionadas antes de reseedear datos demo.

## Riesgos detectados

- Si producción queda con `VITE_USE_MOCKS=true`, la interfaz puede mostrar un flujo funcional sin persistencia real.
- Si faltan variables de Supabase, la app puede terminar usando mocks o un cliente no utilizable.
- Hay datos que viven solo en `localStorage` o en arrays estáticos, por lo que desaparecen al recargar, limpiar navegador o cambiar de equipo.
- Los seeds de QA/demo pueden borrar registros si alguien los ejecuta contra una base equivocada.
- Algunas vistas usan fallback local cuando falla una consulta, lo que puede ocultar un problema de conexión o permisos.

## Causa probable de “se borra la información”

1. La app está corriendo en modo mock o demo en vez de Supabase real.
2. Parte de la funcionalidad visible guarda solo en `localStorage`, estado React o datos hardcodeados.
3. Algunos flujos muestran información calculada o estimada aunque no exista persistencia real.
4. Los seeds de QA/demo pueden reescribir registros al volver a ejecutarse.

## Qué funciona

- Proveedores, insumos, stock MP, fórmulas, órdenes, cierre de orden, finanzas y dashboard tienen mejor trazabilidad contra Supabase real.
- El selector central de backend ya quedó protegido para no pasar silenciosamente a mock en producción.

## Qué está roto o no confiable

- Clientes.
- Alertas.
- Auth/session demo.
- Programación visual desde productos.
- Cualquier dato que dependa de `localStorage`, arrays hardcodeados o fallback local.

## Checklist para producción

- `VITE_USE_MOCKS=false`
- `VITE_SUPABASE_URL` definido
- `VITE_SUPABASE_ANON_KEY` definido
- No usar `.env` local de desarrollo para desplegar producción
- Revisar que ningún flujo crítico dependa de `localStorage` para persistencia
- Revisar que los seeds QA/demo no se ejecuten sobre producción
- Verificar que las consultas lean la misma tabla donde se hace el `insert` o `update`

## Correcciones recomendadas antes de Fase 2

- Migrar clientes a persistencia real en Supabase.
- Mover alertas y sesión/auth fuera de `localStorage`.
- Reemplazar la programación visual por inserción real contra la tabla correspondiente.
- Eliminar fallbacks silenciosos que oculten errores de conexión o permisos.
- Separar claramente seeds demo/QA de cualquier entorno productivo.
- Agregar validaciones de arranque para bloquear despliegues con env incompleta.

## Resultado de esta validación

- La app ya quedó protegida para no aparentar persistencia real en producción si el entorno está mal configurado.
- La base de riesgo principal sigue siendo la mezcla entre Supabase real y flujos demo/locales.
- La prioridad para Fase 2 debe ser eliminar o aislar los flujos no persistentes antes de ampliar funcionalidad.
