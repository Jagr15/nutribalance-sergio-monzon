# FASE 1.3 - Validación de despliegue real

## Objetivo

Confirmar de forma mínima y segura que el entorno local o desplegado está usando Supabase real y no mocks.

## Señal técnica disponible

La app ya expone un resumen seguro de runtime desde `src/infrastructure/api/runtimeConfig.ts`.

Esa señal informa:

- `backend`: `mock` o `supabase`
- `environment`: `development` o `production`
- `missingVariables`: variables requeridas que falten
- `hasSupabaseConfig`: si hay URL y anon key cargadas

Además:

- `src/infrastructure/api/index.ts` sigue siendo el selector central del backend.
- `src/infrastructure/api/supabase/client.ts` usa el mismo guard.
- En consola del navegador se imprime un resumen seguro con el prefijo `[nutribalance/runtime]`.

## Cómo validar local con Supabase real

1. Crear o usar un `.env.local` con:

```env
VITE_USE_MOCKS=false
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_PUBLICA
```

2. Levantar la app local.
3. Abrir la consola del navegador.
4. Confirmar que el resumen muestra:

- `backend: supabase`
- `environment: development`
- `missingVariables: []`

5. Crear un registro simple, por ejemplo:

- un proveedor
- o un insumo

6. Refrescar el navegador.
7. Cerrar y volver a abrir la app.
8. Confirmar que el registro sigue visible.
9. Ir a Supabase Table Editor y verificar que el dato existe en la tabla real.
10. Si el registro era de prueba, eliminarlo manualmente solo después de confirmar la persistencia.

## Cómo validar en Vercel después del redeploy

1. Ir a `Project Settings > Environment Variables`.
2. Confirmar:

- `VITE_USE_MOCKS=false`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. Asegurarse de que estén aplicadas en el entorno correcto:

- `Production`
- `Preview` si también se usa preview real

4. Hacer redeploy obligatorio después de cambiar variables.
5. Abrir la URL desplegada.
6. Verificar la consola del navegador.
7. Confirmar que el resumen indica:

- `backend: supabase`
- `environment: production`
- `missingVariables: []`

8. Crear un registro simple.
9. Recargar la página.
10. Confirmar que el dato sigue ahí.
11. Verificar en Supabase Table Editor.

## Qué evidencia buscar

- En consola:
  - resumen `[nutribalance/runtime]`
  - backend activo
  - entorno activo
  - variables faltantes vacías
- En Supabase:
  - el registro realmente existe
  - el registro persiste después de refresh, cierre y redeploy
- En la app:
  - no aparece comportamiento de mock o demo cuando el entorno está configurado para Supabase real

## Qué no hacer

- No correr seeds demo o QA contra una base real.
- No asumir que Vercel quedó bien solo porque el build pasó.
- No confiar en `.env` local como evidencia de producción.
- No guardar llaves reales en documentos o plantillas compartidas.
- No interpretar un flujo visual como persistencia si no hubo `insert` o `update`.

## Riesgos a vigilar

- `VITE_USE_MOCKS=true` en un entorno que se considere productivo.
- Variables faltantes en Vercel.
- Fallbacks silenciosos que oculten fallas de Supabase.
- Seeds QA/demo ejecutados por error sobre una base real.

## Recomendación práctica

La validación mínima más confiable es esta:

1. Backend reportado como `supabase`.
2. Registro de prueba creado.
3. Refresh y reingreso a la app.
4. Registro todavía presente.
5. Registro visible en Table Editor.

Si cualquiera de esos pasos falla, el entorno no debe considerarse listo para producción.

## Estado de preparación

Con la guardia técnica ya aplicada y el resumen de runtime agregado, estamos listos para validar despliegue real de forma segura.

Lo único pendiente antes de considerar el entorno completamente confiable es repetir esta verificación en la URL real desplegada de Vercel con variables correctas.
