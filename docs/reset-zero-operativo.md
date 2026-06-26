# Reset a Cero Operativo

## Objetivo

Limpiar los datos operativos de prueba para arrancar trazabilidad, stock, producción, tesorería y finanzas desde cero, conservando usuarios, permisos, catálogos maestros y configuración base.

## Qué borra

- Fórmulas e ingredientes
- Órdenes de producción
- Órdenes de expedición / salida
- Consumos de lotes
- Stock de materia prima y producto terminado
- Movimientos de stock
- Cheques de tesorería
- Flujo de caja
- Comprobantes
- Histórico contable importado
- Alertas operativas / de estado
- Presupuestos mensuales

## Qué conserva

- `auth.users`
- `usuarios`
- `roles`
- `permisos`
- `roles_permisos`
- `insumos`
- `productos`
- `clientes`
- `proveedores`
- `silos`
- `cuentas_bancarias`
- `categorias_financieras`
- `plan_cuentas`
- Parámetros y configuración base del sistema

## Backup antes de ejecutar

1. Exportar la base completa desde Supabase.
2. Guardar un dump SQL o backup del proyecto.
3. Confirmar que el backup pueda restaurarse en un entorno de prueba.

## Script

Archivo: `scripts/db/reset-zero-operativo.sql`

## Cómo ejecutarlo

1. Revisar el contenido del script.
2. Confirmar que se está en un entorno autorizado.
3. Ejecutar el SQL manualmente contra la base de pruebas.

Ejemplo:

```bash
psql "$DATABASE_URL" -f scripts/db/reset-zero-operativo.sql
```

## Validación posterior

### Conteos esperados en cero

```sql
select count(*) from public.formulas;
select count(*) from public.formula_ingredientes;
select count(*) from public.ordenes_produccion;
select count(*) from public.orden_consumo_lotes;
select count(*) from public.ordenes_expedicion;
select count(*) from public.stock_lotes_mp;
select count(*) from public.stock_movimientos;
select count(*) from public.stock_pt;
select count(*) from public.stock_pt_movimientos;
select count(*) from public.trazabilidad_eventos;
select count(*) from public.tesoreria_cheques;
select count(*) from public.flujo_caja_movimientos;
select count(*) from public.comprobantes;
select count(*) from public.historico_contable_importado;
select count(*) from public.alertas_estado;
select count(*) from public.presupuestos_mensuales;
```

### Chequeos funcionales

- Dashboard en cero
- Stock en cero
- Finanzas en cero
- Tesorería sin cheques
- Trazabilidad vacía
- Creación de nuevos registros desde cero

## Rollback

Si necesitas volver atrás, restaurar el backup exportado antes de correr el reset.

## Checklist antes de correrlo

- [ ] Backup completo generado
- [ ] Entorno correcto confirmado
- [ ] Nadie está operando sobre la base
- [ ] Se revisó el script SQL manual
- [ ] Se validó qué tablas existen realmente
- [ ] Se confirmó que usuarios y catálogos maestros se conservan

