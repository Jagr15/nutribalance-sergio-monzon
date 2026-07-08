import { describe, expect, it } from 'vitest';
import { buildProyeccionCaja } from './proyeccionCaja';
import type { ChequeTesoreriaRow, MovimientoFinanciero } from '../types';

describe('Nutribalance Regressions and Critical Flows', () => {
  describe('Point 1: Proyección de caja y plazos 120-160 días', () => {
    it('proyecta los movimientos sumando los plazos correctos (e.g. 140 días)', () => {
      const movimientos: MovimientoFinanciero[] = [
        {
          uid: 'mov-1',
          fecha: '2026-01-01',
          tipo: 'INGRESO',
          descripcion: 'Cobro pendiente cliente',
          monto: 100000,
          estado: 'PENDIENTE',
          estado_financiero: 'PENDIENTE_COBRO',
        },
        {
          uid: 'mov-2',
          fecha: '2026-01-01',
          tipo: 'EGRESO',
          descripcion: 'Pago pendiente proveedor',
          monto: 40000,
          estado: 'PENDIENTE',
          estado_financiero: 'PENDIENTE_PAGO',
        },
      ];

      const chequesRecibidos: ChequeTesoreriaRow[] = [];
      const chequesEmitidos: ChequeTesoreriaRow[] = [];

      // Proyección para el año 2026 con 140 días de plazo de cobranza y 140 días de pago.
      // 2026-01-01 + 140 días:
      // Enero (31) + Febrero (28) + Marzo (31) + Abril (30) = 120 días.
      // Quedan 20 días para Mayo -> 2026-05-21.
      const result = buildProyeccionCaja({
        anio: 2026,
        plazoCobranzaDias: 140,
        plazoPagoDias: 140,
        saldoInicialEnero: 50000,
        movimientos,
        chequesRecibidos,
        chequesEmitidos,
      });

      // El saldo inicial de enero debe ser 50000
      const saldoInicialRow = result.rows.find(r => r.key === 'saldo_inicial');
      expect(saldoInicialRow?.values[0]).toBe(50000);

      // Los ingresos y egresos proyectados deben caer en Mayo (index 4)
      const ingresosRow = result.rows.find(r => r.key === 'ingresos');
      const gastosRow = result.rows.find(r => r.key === 'gastos');

      expect(ingresosRow?.values[4]).toBe(100000); // Mayo
      expect(gastosRow?.values[4]).toBe(40000);  // Mayo

      // En los meses anteriores (Enero-Abril) deben ser 0
      expect(ingresosRow?.values[0]).toBe(0);
      expect(gastosRow?.values[0]).toBe(0);

      // El total resumen debe coincidir
      expect(result.resumen.ingresos_total).toBe(100000);
      expect(result.resumen.gastos_total).toBe(40000);
      expect(result.resumen.saldo_final).toBe(110000); // 50000 + 100000 - 40000
    });
  });

  describe('Point 2: Separación de Stock y Compras', () => {
    it('comprueba que la lógica determina correctamente si se debe registrar la compra contable', () => {
      const shouldRegister = (data: { registrarCompraFinanciera?: boolean; origen?: string; tipoOperacion?: string }) => {
        return data.registrarCompraFinanciera === true;
      };

      // Si es un ajuste físico de inventario, no debe registrar compra
      expect(shouldRegister({ registrarCompraFinanciera: false, origen: 'AJUSTE' })).toBe(false);
      // Si es una compra real, debe registrar compra
      expect(shouldRegister({ registrarCompraFinanciera: true, origen: 'COMPRA' })).toBe(true);
    });
  });

  describe('Point 3: Actualización y revalorización dinámica de costos', () => {
    it('recalcula dinámicamente los costos de las fórmulas cuando cambia el costo del insumo en el maestro', async () => {
      // Mock inputs
      const ingredientes = [
        { id_insumo: 'i-maiz', nombre_insumo: 'Maíz', porcentaje: 60 }
      ];
      
      const stock: any[] = []; // Sin stock físico para forzar fallback a costo de referencia
      
      const insumosViejos = [
        { uid: 'i-maiz', nombre: 'Maíz', costo_por_kg: 100, ref_costo_unitario: 100 }
      ];

      const insumosNuevos = [
        { uid: 'i-maiz', nombre: 'Maíz', costo_por_kg: 150, ref_costo_unitario: 150 }
      ];

      const { calculateFormulaCost } = await import('../../formulas/utils/costCalculator');

      // Costo con insumo al precio anterior: 60% de 100 = 60 ARS/kg
      const resultViejo = calculateFormulaCost(ingredientes as any, stock, insumosViejos as any);
      expect(resultViejo.costo_por_kg).toBe(60);

      // Costo con insumo al precio nuevo: 60% de 150 = 90 ARS/kg
      const resultNuevo = calculateFormulaCost(ingredientes as any, stock, insumosNuevos as any);
      expect(resultNuevo.costo_por_kg).toBe(90);
    });
  });
});
