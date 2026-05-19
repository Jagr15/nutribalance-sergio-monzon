# Supabase Backend (Sprint 1)

Infraestructura inicial de backend para convivir con el frontend actual (modo mock o modo Supabase por feature flag).

## Requisitos

- Docker Desktop / Docker Engine activo
- Node.js 20+ (ya usan Node 22)

## Inicializar Supabase local

```bash
npx supabase init
npx supabase start
```

## Aplicar esquema y seed local

```bash
npx supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/schema.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seeds/seed.sql
```

## Variables frontend

Usar `.env` con:

```bash
VITE_USE_MOCKS=true
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key-local-o-cloud>
```

Para usar backend real:

```bash
VITE_USE_MOCKS=false
```

## Conectar Supabase Cloud

1. Crear proyecto en Supabase.
2. Ejecutar `supabase link --project-ref <project-ref>` (opcional).
3. Aplicar SQL en SQL Editor (primero `schema.sql`, luego `seed.sql`).
4. Copiar URL y ANON KEY del proyecto:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_USE_MOCKS=false
```

## Alcance Sprint 1

- Incluye: roles, usuarios, proveedores, insumos, silos, lotes MP, ledger de movimientos.
- No incluye aún: auth UI, órdenes complejas, trazabilidad completa, producto terminado, finanzas/cheques.
