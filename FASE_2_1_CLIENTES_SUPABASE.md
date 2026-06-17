# FASE 2.1 - Clientes con persistencia real en Supabase

## Problema original

El módulo de Clientes dependía de datos hardcodeados y estado local. La página mostraba información comercial simulada, y las acciones de crear/editar/suspender solo modificaban memoria de React. Eso hacía que los cambios desaparecieran al refrescar o reabrir la app.

## Qué se implementó

Se conectó el flujo de Clientes a `ApiService` para que en modo real use Supabase y en modo demo siga funcionando con mocks.

## Archivos modificados

- [`src/features/clientes/pages/ClientesPage.tsx`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/features/clientes/pages/ClientesPage.tsx)
- [`src/features/clientes/services/clienteService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/features/clientes/services/clienteService.ts)
- [`src/features/clientes/types/cliente.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/features/clientes/types/cliente.ts)
- [`src/infrastructure/api/types.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/types.ts)
- [`src/infrastructure/api/adapters/supabaseAdapter.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/adapters/supabaseAdapter.ts)
- [`src/infrastructure/api/adapters/mockAdapter.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/adapters/mockAdapter.ts)
- [`src/infrastructure/api/supabase/services/supabaseClienteService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/supabase/services/supabaseClienteService.ts)
- [`src/infrastructure/api/mock/services/mockClienteService.ts`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/src/infrastructure/api/mock/services/mockClienteService.ts)
- [`supabase/schema.sql`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/supabase/schema.sql)
- [`supabase/migrations/202606080001_clientes_comerciales.sql`](/home/itscoque/Documentos/Supra/nutribalance-sergio-monzon/supabase/migrations/202606080001_clientes_comerciales.sql)

## Tabla creada

Se creó `public.clientes` con:

- `id`
- `legacy_uid`
- `nombre`
- `razon_social`
- `cuit`
- `email`
- `telefono`
- `direccion`
- `localidad`
- `provincia`
- `segmento`
- `ubicacion`
- `contacto`
- `producto_principal`
- `condicion_comercial`
- `estado`
- `observaciones`
- `ultima_compra`
- `saldo_pendiente_ars`
- `esta_activo`
- `created_at`
- `updated_at`
- `deleted_at`

También se agregó:

- trigger `trg_clientes_updated_at`
- índice sobre `deleted_at`

## Cómo quedó el flujo

### Modo Supabase real

- `ClientesPage` carga desde `clienteService.findAll()`.
- `clienteService` delega en `ApiService.clientes`.
- `supabaseAdapter` enruta al servicio real de clientes.
- `supabaseClienteService` hace `getAll`, `getById`, `create`, `update` y `delete`.

### Modo mock/demo

- `mockAdapter` usa `mockClienteService`.
- El mock guarda en memoria durante la sesión del navegador.
- La app sigue funcionando, pero no persiste entre recargas reales del entorno.

## Cómo probar en modo Supabase real

1. Configurar:

```env
VITE_USE_MOCKS=false
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_PUBLICA
```

2. Abrir la app.
3. Confirmar en consola el log seguro `[nutribalance/runtime]` con `backend: supabase`.
4. Crear un cliente de prueba desde la pantalla de Clientes.
5. Recargar el navegador.
6. Cerrar y volver a abrir la app.
7. Confirmar que el cliente sigue en la lista.
8. Verificar el registro en Supabase Table Editor.
9. Si era una prueba, desactivarlo o eliminarlo manualmente según corresponda.

## Cómo probar en modo mock

1. Configurar `VITE_USE_MOCKS=true`.
2. Abrir la app.
3. Confirmar en consola que el backend activo es `mock`.
4. Crear un cliente.
5. Recargar la app.
6. Confirmar que el mock conserva la data solo durante la sesión esperada del navegador y no debe considerarse persistencia real.

## Validaciones mínimas

- `nombre` es obligatorio.
- No se permite guardar un cliente vacío.
- Las acciones de editar y suspender/reactivar llaman al servicio, no a arrays locales.
- El listado se refresca después de cada cambio.

## Limitaciones pendientes

- El módulo comercial no incluye todavía historial real de compras ni facturas de cuenta corriente.
- La tabla `clientes` no tiene RLS revisado en esta fase.
- La desactivación actual usa `esta_activo` y estado comercial; no se implementó un borrado duro.
- No se migró auth, alertas ni programación de producción.

## Riesgos pendientes

- Si Vercel queda con `VITE_USE_MOCKS=true`, la app seguirá pareciendo funcional pero sin persistencia real.
- Si faltan variables de Supabase, el backend real no se usará.
- Los seeds QA/demo siguen siendo peligrosos si se ejecutan contra una base productiva.

## Resultado de lint/build

- `npm run lint` OK.
- `npm run build` OK.

## Conclusión

El flujo de Clientes ya quedó conectado a Supabase real para altas, ediciones, listado y desactivación lógica.  
Lo que sigue pendiente es endurecer RLS y completar la capa comercial histórica si se quiere que la pantalla tenga trazabilidad financiera completa.
