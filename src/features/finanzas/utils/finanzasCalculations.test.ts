import { describe, expect, it } from 'vitest';
import {
  calcFlujoNeto,
  calcMargenOperativo,
  normalizeKpis,
  calcularCuentasPorPagar,
  obtenerMontoPendiente,
} from './finanzasCalculations';
import type { MovimientoFinanciero } from '../types';

describe('finanzas calculations', () => {
  it('calcula flujo neto', () => {
    expect(calcFlujoNeto(1000, 700)).toBe(300);
  });

  it('calcula margen operativo', () => {
    expect(calcMargenOperativo(1000, 700)).toBeCloseTo(30, 6);
    expect(calcMargenOperativo(0, 100)).toBe(0);
  });

  it('normaliza kpis', () => {
    const k = normalizeKpis({ ingresos_mes: 1200, egresos_mes: 900 });
    expect(k.flujo_neto).toBe(300);
    expect(k.margen_operativo).toBeCloseTo(25, 6);
  });

  describe('Cuentas por cobrar y pagar (Casos A-E)', () => {
    it('Caso A: cuentasPorPagarRows contiene una fila pendiente por $2.000.000. KPI cuentasPorPagar debe ser $2.000.000', () => {
      const cuentasPorPagarRows: any[] = [
        {
          uid: 'mov-1',
          fecha: '2026-07-02',
          tipo: 'EGRESO',
          descripcion: 'Fila pendiente cuentasPorPagarRows',
          monto: 2000000,
          estado: 'PENDIENTE',
          estado_financiero: 'PENDIENTE_PAGO',
        },
      ];

      const filtrados = calcularCuentasPorPagar(cuentasPorPagarRows);
      expect(filtrados).toHaveLength(1);

      const kpiCuentasPorPagar = filtrados.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0);
      expect(kpiCuentasPorPagar).toBe(2000000);
    });

    it('Caso B: flujo_caja_movimientos tiene EGRESO PENDIENTE con monto $2.000.000 y sin campo saldo. KPI debe sumar $2.000.000', () => {
      const flujo_caja_movimientos: MovimientoFinanciero[] = [
        {
          uid: 'mov-2',
          fecha: '2026-07-02',
          tipo: 'EGRESO',
          descripcion: 'Egreso sin saldo',
          monto: 2000000,
          estado: 'PENDIENTE',
          estado_financiero: 'PENDIENTE_PAGO',
        },
      ];

      const filtrados = calcularCuentasPorPagar(flujo_caja_movimientos);
      expect(filtrados).toHaveLength(1);
      expect(obtenerMontoPendiente(filtrados[0])).toBe(2000000);

      const kpiCuentasPorPagar = filtrados.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0);
      expect(kpiCuentasPorPagar).toBe(2000000);
    });

    it('Caso C: comprobantes tiene FACTURA_COMPRA con saldo $1.500.000. KPI debe sumar $1.500.000', () => {
      const comprobantes: any[] = [
        {
          uid: 'comp-1',
          fecha: '2026-07-02',
          tipo: 'EGRESO',
          descripcion: 'Factura Compra Proveedor',
          saldo: 1500000,
          estado: 'PENDIENTE',
          estado_financiero: 'PENDIENTE_PAGO',
        },
      ];

      const filtrados = calcularCuentasPorPagar(comprobantes);
      expect(filtrados).toHaveLength(1);
      expect(obtenerMontoPendiente(filtrados[0])).toBe(1500000);

      const kpiCuentasPorPagar = filtrados.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0);
      expect(kpiCuentasPorPagar).toBe(1500000);
    });

    it('Caso D: movimiento EGRESO PAGADO o CONFIRMADO. No debe sumar a cuentas por pagar', () => {
      const movimientos: MovimientoFinanciero[] = [
        {
          uid: 'mov-3',
          fecha: '2026-07-02',
          tipo: 'EGRESO',
          descripcion: 'Egreso PAGADO',
          monto: 2000000,
          estado: 'CONFIRMADO',
          estado_financiero: 'PAGADO',
        },
        {
          uid: 'mov-4',
          fecha: '2026-07-02',
          tipo: 'EGRESO',
          descripcion: 'Egreso CONFIRMADO',
          monto: 1000000,
          estado: 'CONFIRMADO',
          estado_financiero: 'CONFIRMADO',
        },
      ];

      const filtrados = calcularCuentasPorPagar(movimientos);
      expect(filtrados).toHaveLength(0);

      const kpiCuentasPorPagar = filtrados.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0);
      expect(kpiCuentasPorPagar).toBe(0);
    });

    it('Caso E: tabla Cuentas por Pagar vacía. KPI debe ser $0', () => {
      const cuentasPorPagarRows: MovimientoFinanciero[] = [];

      const filtrados = calcularCuentasPorPagar(cuentasPorPagarRows);
      expect(filtrados).toHaveLength(0);

      const kpiCuentasPorPagar = filtrados.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0);
      expect(kpiCuentasPorPagar).toBe(0);
    });
  });
});
