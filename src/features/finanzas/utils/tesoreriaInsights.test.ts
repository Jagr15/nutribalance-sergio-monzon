import { describe, expect, it } from 'vitest';
import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';
import { buildTesoreriaInsights } from './tesoreriaInsights';

const clientes: Cliente[] = [
  { uid: 'cli-1', nombre: 'Estancia La Esperanza', estado: 'Activo', saldoPendienteArs: 325000, estaActivo: true },
  { uid: 'cli-2', nombre: 'Agropecuaria Don Sergio', estado: 'Activo', saldoPendienteArs: 1185000, estaActivo: true },
];

describe('buildTesoreriaInsights', () => {
  it('construye presupuesto, cartera, cheques y alertas de tesorería', () => {
    const movimientos = [
      { fecha: '2026-06-02T10:00:00Z', tipo: 'EGRESO', origen_operativo: 'COMPRA', descripcion: 'Compra MP maiz', monto: 40000, categoria: 'Compras MP', centro_costo: 'Planta' },
      { fecha: '2026-06-05T10:00:00Z', tipo: 'EGRESO', origen_operativo: 'PRODUCCION', descripcion: 'Produccion OP 1', monto: 47000, categoria: 'Producción', centro_costo: 'Planta' },
      { fecha: '2026-06-06T10:00:00Z', tipo: 'EGRESO', origen_operativo: 'LOGISTICA', descripcion: 'Flete despacho', monto: 18000, categoria: 'Logistica', centro_costo: 'Logistica' },
    ];

    const presupuestos = [
      { anio: 2026, mes: 6, monto_presupuestado: 30000, categoria: 'Compras MP', centro_costo: 'Planta' },
      { anio: 2026, mes: 6, monto_presupuestado: 35000, categoria: 'Producción', centro_costo: 'Planta' },
    ];

    const comprobantes = [
      { cliente_id: 'cli-1', tercero: 'Estancia La Esperanza', fecha_emision: '2026-05-20', fecha_vencimiento: '2026-05-28', estado: 'VENCIDO', saldo: 325000, tipo: 'FACTURA_VENTA' },
      { cliente_id: 'cli-2', tercero: 'Agropecuaria Don Sergio', fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-25', estado: 'PENDIENTE', saldo: 1185000, tipo: 'FACTURA_VENTA' },
    ];

    const ventasPt: MovimientoStockPT[] = [
      {
        id: 'mov-1',
        stock_pt_id: 'pt-1',
        producto_id: 'form-1',
        nombre_producto: 'Pellet Crecimiento',
        lote: 'L1',
        numero_orden: 'OP-1',
        silo: 'Silo 1',
        tipo: 'SALIDA',
        cantidad: 60,
        unidad: 'KG',
        costo_unitario: 360,
        valor_total: 21600,
        motivo: 'Salida',
        referencia: 'R1',
        cliente_id: 'cli-1',
        created_at: '2026-06-10T10:00:00Z',
      },
    ];

    const cheques = [
      { id: 'ch-1', numero: '0001', tipo: 'RECIBIDO' as const, tercero: 'Estancia La Esperanza', importe: 125000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-20', estado: 'PENDIENTE' as const, cliente_id: 'cli-1', cliente_nombre: 'Estancia La Esperanza' },
      { id: 'ch-2', numero: '0002', tipo: 'EMITIDO' as const, tercero: 'Proveedor X', importe: 78000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-15', estado: 'PENDIENTE' as const, cliente_id: null, cliente_nombre: null },
    ];

    const result = buildTesoreriaInsights(
      presupuestos as never,
      movimientos as never,
      clientes,
      comprobantes as never,
      ventasPt,
      cheques as never,
      100000,
    );

    expect(result.presupuestoVsReal).toHaveLength(7);
    expect(result.presupuestoVsReal.find((row) => row.rubro === 'Compras MP')?.presupuesto).toBe(30000);
    expect(result.carteraClientes[0]?.cliente_nombre).toBe('Agropecuaria Don Sergio');
    expect(result.chequesEmitidos).toHaveLength(1);
    expect(result.chequesRecibidos).toHaveLength(1);
    expect(result.proyeccionFlujo).toHaveLength(4);
    expect(result.alertasTesoreria.length).toBeGreaterThan(0);
    expect(result.gastosPorRubro.reduce((acc, row) => acc + row.porcentaje, 0)).toBeCloseTo(100, 2);
  });

  it('genera alerta crítica por descubierto cuando un cheque emitido no tendrá fondos', () => {
    const result = buildTesoreriaInsights(
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [
        {
          id: 'chq-1',
          numero: '000123',
          tipo: 'EMITIDO',
          tercero: 'Proveedor Riesgo SA',
          importe: 120000,
          fecha_emision: '2026-06-10',
          fecha_vencimiento: '2026-06-20',
          estado: 'PENDIENTE',
          cliente_id: null,
          cliente_nombre: null,
        },
      ] as never,
      10000,
    );

    const alerta = result.alertasTesoreria.find((item) => item.tipo === 'Cheque emitido que vence hoy' || item.tipo === 'Riesgo de descubierto por cheque');
    expect(alerta).toBeDefined();
    expect(alerta?.prioridad).toBe('critica');
    expect(alerta?.titulo).toContain('000123');
    expect(alerta?.dato_asociado).toMatchObject({
      cheque: '000123',
      tercero: 'Proveedor Riesgo SA',
      importe: 120000,
      vence: '2026-06-20',
    });
    expect(typeof alerta?.dato_asociado.saldo_proyectado).toBe('number');
    expect((alerta?.dato_asociado.saldo_proyectado as number)).toBeLessThan(0);
  });
});
