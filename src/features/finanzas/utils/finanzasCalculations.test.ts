import { describe, expect, it } from 'vitest';
import {
  calcFlujoNeto,
  calcMargenOperativo,
  calcularCuentasPorCobrar,
  calcularCuentasPorPagar,
  isMovimientoCajaReal,
  normalizeKpis,
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

    it('Caso C: movimiento con FACTURA_COMPRA pendiente usa comprobante_saldo como monto pendiente', () => {
      const comprobantes: any[] = [
        {
          uid: 'comp-1',
          fecha: '2026-07-02',
          tipo: 'EGRESO',
          descripcion: 'Factura Compra Proveedor',
          monto: 2000000,
          comprobante_tipo: 'FACTURA_COMPRA',
          comprobante_saldo: 1500000,
          comprobante_estado: 'PENDIENTE',
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

    it('FACTURA_VENTA pendiente suma a CxC pero no cuenta como caja', () => {
      const movimientos: MovimientoFinanciero[] = [
        {
          uid: 'venta-1',
          fecha: '2026-07-02',
          tipo: 'INGRESO',
          origen_operativo: 'VENTA_PT',
          descripcion: 'Venta facturada a crédito',
          monto: 500000,
          comprobante_tipo: 'FACTURA_VENTA',
          comprobante_estado: 'PENDIENTE',
          comprobante_saldo: 500000,
          estado: 'CONFIRMADO',
          estado_financiero: 'CONFIRMADO',
        },
      ];

      expect(calcularCuentasPorCobrar(movimientos)).toHaveLength(1);
      expect(isMovimientoCajaReal(movimientos[0])).toBe(false);
    });

    it('COBRANZA confirmada cuenta como caja real', () => {
      const movimiento: MovimientoFinanciero = {
        uid: 'cob-1',
        fecha: '2026-07-02',
        tipo: 'INGRESO',
        origen_operativo: 'COBRANZA',
        descripcion: 'Recibo aplicado',
        monto: 500000,
        comprobante_tipo: 'RECIBO',
        comprobante_estado: 'PAGADO',
        comprobante_saldo: 0,
        estado: 'CONFIRMADO',
        estado_financiero: 'COBRADO',
        fecha_cobro_pago: '2026-07-02',
      };

      expect(isMovimientoCajaReal(movimiento)).toBe(true);
      expect(calcularCuentasPorCobrar([movimiento])).toHaveLength(0);
    });

    it('VENTA_PT pagada no cuenta caja real por sí sola si la cobranza se registra aparte', () => {
      const movimientos: MovimientoFinanciero[] = [
        {
          uid: 'venta-pagada',
          fecha: '2026-07-02',
          tipo: 'INGRESO',
          origen_operativo: 'VENTA_PT',
          descripcion: 'Factura venta pagada',
          monto: 500000,
          comprobante_tipo: 'FACTURA_VENTA',
          comprobante_estado: 'PAGADO',
          comprobante_saldo: 0,
          estado: 'CONFIRMADO',
          estado_financiero: 'COBRADO',
          fecha_cobro_pago: '2026-07-02',
        },
        {
          uid: 'recibo-1',
          fecha: '2026-07-02',
          tipo: 'INGRESO',
          origen_operativo: 'COBRANZA',
          descripcion: 'Recibo asociado',
          monto: 500000,
          comprobante_tipo: 'RECIBO',
          comprobante_estado: 'PAGADO',
          comprobante_saldo: 0,
          estado: 'CONFIRMADO',
          estado_financiero: 'COBRADO',
          fecha_cobro_pago: '2026-07-02',
        },
      ];

      expect(isMovimientoCajaReal(movimientos[0])).toBe(false);
      expect(isMovimientoCajaReal(movimientos[1])).toBe(true);
    });

    it('COMPRA_MP pagada sí cuenta como egreso real', () => {
      const movimiento: MovimientoFinanciero = {
        uid: 'cmp-pagada',
        fecha: '2026-07-02',
        tipo: 'EGRESO',
        origen_operativo: 'COMPRA_MP',
        descripcion: 'Compra MP pagada',
        monto: 1200000,
        estado: 'CONFIRMADO',
        estado_financiero: 'PAGADO',
        fecha_cobro_pago: '2026-07-03',
      };

      expect(isMovimientoCajaReal(movimiento)).toBe(true);
      expect(calcularCuentasPorPagar([movimiento])).toHaveLength(0);
    });

    it('COMPRA_MP pendiente suma CxP y no egreso real', () => {
      const movimiento: MovimientoFinanciero = {
        uid: 'cmp-pendiente',
        fecha: '2026-07-02',
        tipo: 'EGRESO',
        origen_operativo: 'COMPRA_MP',
        descripcion: 'Compra MP pendiente',
        monto: 1200000,
        estado: 'PENDIENTE',
        estado_financiero: 'PENDIENTE_PAGO',
      };

      expect(isMovimientoCajaReal(movimiento)).toBe(false);
      expect(calcularCuentasPorPagar([movimiento])).toHaveLength(1);
    });

    it('COMPRA_MP confirmada con estado_financiero null no cuenta egreso real automáticamente', () => {
      const movimiento: MovimientoFinanciero = {
        uid: 'cmp-ambigua',
        fecha: '2026-07-02',
        tipo: 'EGRESO',
        origen_operativo: 'COMPRA_MP',
        descripcion: 'Compra MP ambigua',
        monto: 1200000,
        estado: 'CONFIRMADO',
      };

      expect(isMovimientoCajaReal(movimiento)).toBe(false);
      expect(calcularCuentasPorPagar([movimiento])).toHaveLength(0);
    });
  });
});
