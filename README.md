# NutriBalance Frontend

Aplicación frontend de NutriBalance construida con React + TypeScript + Vite.

## Requisitos

- Node.js requerido: **20+** (recomendado: **20.x LTS**)
- npm recomendado: **10.x**

## Uso con nvm

Este proyecto incluye `.nvmrc` con Node 20.

```bash
nvm use
npm install
npm run test
```

Si no tienes instalada esa versión:

```bash
nvm install 20
nvm use
```

## Instalación

```bash
npm install
```

## Configuración de entorno

Crear `.env` desde `.env.example`.

Variables clave:

- `VITE_USE_MOCKS=true` para usar mocks locales.
- `VITE_USE_MOCKS=false` para usar Supabase (Sprint 1).
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Modo desarrollo

```bash
npm run dev
```

Vite mostrará la URL local (normalmente `http://localhost:5173`).

## Build de producción

```bash
npm run build
```

Genera la carpeta `dist/`.

## Preview de build

```bash
npm run preview
```

## Lint

```bash
npm run lint
```

Si en tu entorno falla el formatter por defecto de ESLint, puedes validar errores reales con:

```bash
npm run lint -- --format json
```

## Estado de datos (Mocks / Supabase)

El switch está en `src/infrastructure/api/index.ts`:

- `VITE_USE_MOCKS=true` => todo funciona con mocks.
- `VITE_USE_MOCKS=false` + variables Supabase válidas => usa adapter Supabase para:
  - proveedores
  - insumos
  - stock de materia prima
  - silos

En Sprint 1 Fase 1, `usuarios` sigue en mock y ya se migró `fórmulas` + `órdenes` a Supabase.

## Backend Supabase

La infraestructura inicial está en `/supabase`:

- `schema.sql`
- `migrations/`
- `seeds/seed.sql`
- `README.md` con pasos local/cloud

## Demo Cliente (Recomendado)

Para una demo comercial estable:

1. Usar `VITE_USE_MOCKS=true`.
2. Levantar con `npm run dev`.
3. Recorrer flujo:
   - Dashboard
   - Insumos y alertas
   - Ingreso de materia prima
   - Proveedores
   - Silos
   - Fórmulas (Alimento Lechera / Pellet Cerdo Crecimiento)
   - Órdenes (pendiente, en proceso, finalizada)
   - Iniciar orden y finalizar con merma manual

### Qué está operativo hoy

- Catálogos: insumos, proveedores, silos.
- Gestión base de fórmulas.
- Órdenes de producción con estados y merma manual.
- Cálculo de costo estimado por orden.
- Reserva de stock en tránsito en flujo mock.

### Siguiente fase

- Trazabilidad FIFO completa end-to-end.
- Integración full backend para todos los módulos.
- Finanzas, cheques y reportes ejecutivos.
