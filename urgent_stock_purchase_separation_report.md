# Reporte urgente: separación entre stock e ingreso financiero de MP

Fecha: 2026-07-08

## Problema detectado

El flujo de alta/ingreso de materia prima llamaba automáticamente a `contabilidadOperativaService.registrarCompraMateriaPrima()` desde `stockMateriaPrimaService.create()`.

Esa implementación hacía que cualquier alta de lote o carga de stock pudiera terminar registrada como compra financiera `COMPRA_MP`, contaminando:

- `flujo_caja_movimientos`
- cuentas por pagar
- tesorería
- estados financieros
- proyección de caja

## Corrección aplicada

### 1. Separación explícita de intención operativa

En `src/features/insumos/services/stockMateriaPrimaService.ts` se agregó una condición explícita para registrar compra financiera solo cuando el payload indique compra real mediante alguno de estos marcadores:

- `registrarCompraFinanciera === true`
- `origen === 'COMPRA'`
- `tipoOperacion === 'COMPRA'`

Si el ingreso corresponde a ajuste, carga inicial, corrección o cualquier otro flujo no marcado como compra, no se llama a contabilidad operativa.

### 2. Endurecimiento de validaciones contables

En `src/features/finanzas/services/contabilidadOperativaService.ts` se reforzó `registrarCompraMateriaPrima()` para rechazar compras incompletas.

Ahora exige:

- `stock_lote_legacy_uid`
- `fecha`
- `lote`
- `insumo`
- `proveedor`
- `monto > 0`
- `remito/documento` o `condicion_pago`

Con esto se evita que un alta operativa deficiente termine aceptándose como compra real.

### 3. Separación visible en UI

En `src/features/insumos/pages/StockMateriaPrimaPage.tsx` y `src/features/insumos/components/StockMateriaPrimaModal.tsx` se separaron las acciones:

- `Registrar Compra MP`
- `Ajustar Stock / Carga Inicial`

Ambas reutilizan el mismo modal, pero con intención distinta:

- compra real: actualiza stock y registra `COMPRA_MP`
- ajuste/carga inicial: actualiza inventario y no genera movimiento financiero

Además, el resumen principal dejó de rotular esos registros como “Compras registradas” y pasó a “Ingresos registrados”.

## Resultado funcional esperado

- Las cargas de insumo/stock ya no aparecen como compras en Finanzas.
- Los ajustes manuales ya no crean cuentas por pagar.
- Solo las compras reales de MP generan `COMPRA_MP` en `flujo_caja_movimientos`.
- La valorización de inventario sigue funcionando sin mezclarla con tesorería.

## Tests ajustados

Se cubrieron estos escenarios:

- carga inicial de stock no registra compra financiera
- compra real sí registra `COMPRA_MP`
- contabilidad rechaza compras incompletas
- una compra real aparece en movimientos y en cuentas por pagar
- una carga de stock sin movimiento financiero no afecta cuentas por pagar

Archivos de test tocados:

- `src/features/insumos/services/stockMateriaPrimaService.compras.test.ts`
- `src/features/finanzas/services/contabilidadOperativaService.test.ts`
- `src/features/finanzas/services/finanzasService.inventory.test.ts`

## Verificación ejecutada

### OK

- `npm test -- --run src/features/insumos/services/stockMateriaPrimaService.compras.test.ts src/features/finanzas/services/contabilidadOperativaService.test.ts src/features/finanzas/services/finanzasService.inventory.test.ts`
- `npm run build`

### Pendiente del repositorio

`npm run test` no quedó completamente verde por fallas preexistentes ajenas a este cambio en:

- `src/features/clientes/services/clienteService.test.ts`

Las fallas observadas están concentradas en la suite `mockClienteService.getPagos` y no provienen de la separación entre stock y compras de MP.
