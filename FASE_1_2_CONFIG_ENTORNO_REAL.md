# FASE 1.2 - Configuración real de entorno

## Estado actual

- La selección entre Supabase y mocks se resuelve en `src/infrastructure/api/runtimeConfig.ts`.
- `src/infrastructure/api/index.ts` usa ese guard como única fuente para elegir `supabaseAdapter` o `mockAdapter`.
- `src/infrastructure/api/supabase/client.ts` también depende del mismo guard para evitar divergencias.
- `.env` actual está en modo demo: `VITE_USE_MOCKS=true`.
- `vercel.json` solo define rewrites de SPA y no configura variables de entorno.

## Variables requeridas para modo real

- `VITE_USE_MOCKS=false`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Variables permitidas para modo demo o local

- `VITE_USE_MOCKS=true`

## Cómo configurar local

La forma recomendada es usar un archivo `.env.local` no versionado para desarrollo real contra Supabase.

Ejemplo seguro:

```env
VITE_USE_MOCKS=false
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_PUBLICA
```

Notas:

- No incluir llaves reales en este documento ni en plantillas compartidas.
- `.env` del repo puede seguir apuntando a demo para desarrollo local si ese es el estado actual del proyecto.
- Para modo real, el valor importante es que el entorno activo tenga `VITE_USE_MOCKS=false` y las dos variables de Supabase definidas.

## Cómo configurar Vercel

Configurar las variables en `Project Settings > Environment Variables`:

- `VITE_USE_MOCKS=false`
- `VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co`
- `VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_PUBLICA`

Aplicación recomendada:

- `Production`: siempre
- `Preview`: si querés probar contra Supabase real también en previews
- `Development`: solo si vas a correr builds de Vercel con Supabase real

Puntos clave:

- Después de cambiar variables, hay que hacer redeploy.
- No alcanza con `vercel.json` si ese archivo no contiene variables de entorno.
- Si `VITE_USE_MOCKS` queda en `true`, la app puede quedar en demo aunque el resto de la configuración exista.

## Checklist de verificación

- Abrir la app en el entorno objetivo.
- Confirmar que el build usa `VITE_USE_MOCKS=false`.
- Crear un proveedor o un insumo de prueba.
- Refrescar el navegador.
- Cerrar y abrir sesión.
- Confirmar en Supabase Table Editor que el dato sigue existiendo.
- Confirmar que el dato no desaparece después de un redeploy.

## Riesgos

- `.env` con `VITE_USE_MOCKS=true` en un entorno que se cree productivo.
- `.env.example` incompleto o ambiguo, que haga pensar que Supabase ya está listo.
- Variables faltantes o mal cargadas en Vercel.
- Seeds QA o demo ejecutados contra una base real.
- Fallbacks silenciosos que oculten errores de Supabase y hagan parecer que guardó algo cuando no persistió.

## Recomendación operativa

- Mantener `.env.example` como plantilla segura.
- Usar `.env.local` para desarrollo real.
- Verificar variables en Vercel antes de cada despliegue productivo.
- No confiar en el repositorio local para asumir que producción quedó configurada.

## Resultado

- La configuración correcta para modo real ya está clara y documentada.
- El punto crítico sigue siendo el entorno donde corre el build, no solo el código.
- Para producción, la condición mínima es: `VITE_USE_MOCKS=false` más credenciales públicas válidas de Supabase en Vercel.
