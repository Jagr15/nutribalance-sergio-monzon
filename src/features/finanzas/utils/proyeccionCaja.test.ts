import { describe, expect, it } from 'vitest';
import { buildProyeccionCaja } from './proyeccionCaja';

describe('buildProyeccionCaja', () => {
  it('proyecta ingresos y gastos por mes, deja meses vacíos en cero y no rompe rentabilidad sin ingresos', () => {
    const result = buildProyeccionCaja({
      anio: 2026,
      plazoCobranzaDias: 120,
      plazoPagoDias: 120,
      saldoInicialEnero: 1000,
      cliente: '',
      proveedor: '',
      tipoMovimiento: '',
      movimientos: [
        {
          uid: 'mov-1',
          fecha: '2026-01-15',
          tipo: 'INGRESO',
          descripcion: 'Cobranza pendiente',
          monto: 5000,
          estado: 'PENDIENTE',
          fecha_operacion: '2026-01-15',
          estado_financiero: 'PENDIENTE_COBRO',
        },
        {
          uid: 'mov-2',
          fecha: '2026-02-10',
          tipo: 'EGRESO',
          descripcion: 'Pago pendiente',
          monto: 2000,
          estado: 'PENDIENTE',
          fecha_operacion: '2026-02-10',
          estado_financiero: 'PENDIENTE_PAGO',
        },
      ],
      chequesRecibidos: [],
      chequesEmitidos: [],
    });

    const ingresos = result.rows.find((row) => row.key === 'ingresos');
    const gastos = result.rows.find((row) => row.key === 'gastos');
    const ganancia = result.rows.find((row) => row.key === 'ganancia_perdida');
    const acumulado = result.rows.find((row) => row.key === 'acumulado');
    const rentabilidad = result.rows.find((row) => row.key === 'rentabilidad');

    expect(ingresos?.values[0]).toBe(0);
    expect(rentabilidad?.values[0]).toBeNull();

    expect(ingresos?.values[4]).toBe(5000);
    expect(gastos?.values[5]).toBe(2000);
    expect(ganancia?.values[4]).toBe(5000);
    expect(ganancia?.values[5]).toBe(-2000);
    expect(acumulado?.values[0]).toBe(1000);
    expect(acumulado?.values[4]).toBe(6000);
    expect(acumulado?.values[5]).toBe(4000);
    expect(result.resumen.rentabilidad_total).toBeCloseTo(0.6, 5);
  });

  it('aplica filtros de cliente, proveedor y tipo sin modificar importes originales', () => {
    const result = buildProyeccionCaja({
      anio: 2026,
      plazoCobranzaDias: 120,
      plazoPagoDias: 120,
      saldoInicialEnero: 0,
      cliente: 'Cliente A',
      proveedor: 'Proveedor Z',
      tipoMovimiento: 'INGRESO',
      movimientos: [
        {
          uid: 'mov-1',
          fecha: '2026-01-01',
          tipo: 'INGRESO',
          descripcion: 'Cobranza del cliente',
          monto: 8000,
          estado: 'PENDIENTE',
          fecha_operacion: '2026-01-01',
          estado_financiero: 'PENDIENTE_COBRO',
        },
        {
          uid: 'mov-2',
          fecha: '2026-01-01',
          tipo: 'EGRESO',
          descripcion: 'Pago a proveedor',
          monto: 3000,
          estado: 'PENDIENTE',
          fecha_operacion: '2026-01-01',
          estado_financiero: 'PENDIENTE_PAGO',
        },
      ],
      chequesRecibidos: [
        {
          id: 'ch-1',
          numero: '0001',
          tipo: 'RECIBIDO',
          tercero: 'Cliente A',
          importe: 12000,
          fecha_emision: '2026-01-05',
          fecha_vencimiento: '2026-01-20',
          estado: 'PENDIENTE',
          cliente_id: 'cli-1',
          cliente_nombre: 'Cliente A',
        },
      ],
      chequesEmitidos: [
        {
          id: 'ch-2',
          numero: '0002',
          tipo: 'EMITIDO',
          tercero: 'Proveedor Z',
          importe: 7000,
          fecha_emision: '2026-01-05',
          fecha_vencimiento: '2026-01-20',
          estado: 'PENDIENTE',
          cliente_id: null,
          cliente_nombre: null,
        },
      ],
    });

    expect(result.items.every((item) => item.tipo === 'INGRESO')).toBe(true);
    expect(result.items.every((item) => item.cliente_nombre === 'Cliente A' || item.fuente === 'Movimiento financiero')).toBe(true);
    expect(result.resumen.gastos_total).toBe(0);
    expect(result.resumen.ingresos_total).toBe(12000);
  });
});
