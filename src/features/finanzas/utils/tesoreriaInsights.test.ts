import { vi } from 'vitest';

vi.hoisted(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
});

import { afterAll, describe, expect, it } from 'vitest';
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

    const alerta = result.alertasTesoreria.find((item) => item.tipo === 'Cheque emitido vence hoy / cubrir fondos' || item.tipo === 'Riesgo de descubierto por cheque');
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

  it('calcula flujo proyectado neto de cheques y alerta de flujo negativo basándose en neto', () => {
    const resultRecibidos = buildTesoreriaInsights(
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [
        { id: 'ch-1', numero: '0001', tipo: 'RECIBIDO', tercero: 'Cliente A', importe: 50000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-20', estado: 'PENDIENTE', cliente_id: null, cliente_nombre: null },
      ] as never,
      10000,
    );
    const pf7_recibidos = resultRecibidos.proyeccionFlujo.find((p) => p.horizonte === '7 días');
    expect(pf7_recibidos?.ingresos_estimados).toBe(50000);
    expect(pf7_recibidos?.egresos_estimados).toBe(0);
    expect(pf7_recibidos?.saldo_estimado).toBe(60000);

    const resultEmitidos = buildTesoreriaInsights(
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [
        { id: 'ch-2', numero: '0002', tipo: 'EMITIDO', tercero: 'Proveedor X', importe: 30000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-20', estado: 'PENDIENTE', cliente_id: null, cliente_nombre: null },
      ] as never,
      10000,
    );
    const pf7_emitidos = resultEmitidos.proyeccionFlujo.find((p) => p.horizonte === '7 días');
    expect(pf7_emitidos?.ingresos_estimados).toBe(0);
    expect(pf7_emitidos?.egresos_estimados).toBe(30000);
    expect(pf7_emitidos?.saldo_estimado).toBe(-20000);

    const resultNeto = buildTesoreriaInsights(
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [
        { id: 'ch-1', numero: '0001', tipo: 'RECIBIDO', tercero: 'Cliente A', importe: 100000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-20', estado: 'PENDIENTE', cliente_id: null, cliente_nombre: null },
        { id: 'ch-2', numero: '0002', tipo: 'EMITIDO', tercero: 'Proveedor X', importe: 40000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-20', estado: 'PENDIENTE', cliente_id: null, cliente_nombre: null },
      ] as never,
      0,
    );
    const pf7_neto = resultNeto.proyeccionFlujo.find((p) => p.horizonte === '7 días');
    expect(pf7_neto?.ingresos_estimados).toBe(100000);
    expect(pf7_neto?.egresos_estimados).toBe(40000);
    expect(pf7_neto?.saldo_estimado).toBe(60000);

    const resultAlerta = buildTesoreriaInsights(
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [
        { id: 'ch-1', numero: '0001', tipo: 'RECIBIDO', tercero: 'Cliente A', importe: 100000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-20', estado: 'PENDIENTE', cliente_id: null, cliente_nombre: null },
        { id: 'ch-2', numero: '0002', tipo: 'EMITIDO', tercero: 'Proveedor X', importe: 140000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-20', estado: 'PENDIENTE', cliente_id: null, cliente_nombre: null },
      ] as never,
      10000,
    );
    const alertaFlujo = resultAlerta.alertasTesoreria.find((a) => a.tipo === 'Flujo de caja proyectado negativo');
    expect(alertaFlujo).toBeDefined();
    expect(alertaFlujo?.titulo).toContain('7 días');
  });

  it('valida las reglas de alertas para cheques recibidos y emitidos de forma individual', () => {
    // 1. Cheque recibido futuro: no alerta
    // 2. Cheque recibido hoy: sí alerta
    // 3. Dos recibidos el mismo día: generan dos alertas independientes
    // 4. Cheque recibido vencido: genera alerta
    // 5. Cheque recibido depositado/cobrado/endosado/pagado: no alerta
    // 6. Cheque emitido hoy: alerta
    // 7. Cheque emitido vencido: alerta
    // 8. Cheque emitido cerrado (pagado/cobrado/etc.): no alerta
    // 9. created_at no influye en las alertas
    const mockCheques = [
      { id: 'ch-recibido-futuro', numero: 'RC-01', tipo: 'RECIBIDO', tercero: 'Cli A', importe: 1000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-19', estado: 'PENDIENTE', created_at: '2026-06-01' },
      { id: 'ch-recibido-hoy-1', numero: 'RC-02', tipo: 'RECIBIDO', tercero: 'Cli B', importe: 2000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-18', estado: 'PENDIENTE', created_at: '2026-06-01' },
      { id: 'ch-recibido-hoy-2', numero: 'RC-03', tipo: 'RECIBIDO', tercero: 'Cli C', importe: 3000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-18', estado: 'PENDIENTE', created_at: '2026-06-01' },
      { id: 'ch-recibido-vencido', numero: 'RC-04', tipo: 'RECIBIDO', tercero: 'Cli D', importe: 4000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-17', estado: 'PENDIENTE', created_at: '2026-06-01' },
      { id: 'ch-recibido-cobrado', numero: 'RC-05', tipo: 'RECIBIDO', tercero: 'Cli E', importe: 5000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-18', estado: 'COBRADO', created_at: '2026-06-01' },
      { id: 'ch-emitido-hoy', numero: 'EM-01', tipo: 'EMITIDO', tercero: 'Prov A', importe: 6000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-18', estado: 'PENDIENTE', created_at: '2026-06-01' },
      { id: 'ch-emitido-vencido', numero: 'EM-02', tipo: 'EMITIDO', tercero: 'Prov B', importe: 7000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-17', estado: 'PENDIENTE', created_at: '2026-06-01' },
      { id: 'ch-emitido-pagado', numero: 'EM-03', tipo: 'EMITIDO', tercero: 'Prov C', importe: 8000, fecha_emision: '2026-06-10', fecha_vencimiento: '2026-06-18', estado: 'PAGADO', created_at: '2026-06-01' },
    ];

    const result = buildTesoreriaInsights(
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      [] as never,
      mockCheques as never,
      100000,
    );

    const alertas = result.alertasTesoreria;

    // 1. Cheque recibido futuro: no alerta
    const depFuturo = alertas.find((a) => a.alerta_id === 'tes-cheque-recibido-hoy-ch-recibido-futuro');
    expect(depFuturo).toBeUndefined();

    // 2. Cheque recibido hoy: sí alerta
    const depHoy1 = alertas.find((a) => a.alerta_id === 'tes-cheque-recibido-hoy-ch-recibido-hoy-1');
    expect(depHoy1).toBeDefined();
    expect(depHoy1?.tipo).toBe('Cheque recibido listo para depositar');

    // 3. Dos recibidos el mismo día: generan dos alertas independientes
    const depHoy2 = alertas.find((a) => a.alerta_id === 'tes-cheque-recibido-hoy-ch-recibido-hoy-2');
    expect(depHoy2).toBeDefined();

    // 4. Cheque recibido vencido: genera alerta
    const vencido = alertas.find((a) => a.alerta_id === 'tes-cheque-recibido-vencido-ch-recibido-vencido');
    expect(vencido).toBeDefined();
    expect(vencido?.tipo).toBe('Cheque recibido vencido');

    // 5. Cheque recibido depositado/cobrado/endosado/pagado: no alerta
    const cobrado = alertas.find((a) => a.alerta_id.includes('ch-recibido-cobrado'));
    expect(cobrado).toBeUndefined();

    // 6. Cheque emitido hoy: alerta
    const emHoy = alertas.find((a) => a.alerta_id === 'tes-cheque-emitido-hoy-ch-emitido-hoy');
    expect(emHoy).toBeDefined();
    expect(emHoy?.tipo).toBe('Cheque emitido vence hoy / cubrir fondos');

    // 7. Cheque emitido vencido: alerta
    const emVencido = alertas.find((a) => a.alerta_id === 'tes-cheque-emitido-vencido-ch-emitido-vencido');
    expect(emVencido).toBeDefined();
    expect(emVencido?.tipo).toBe('Cheque emitido vencido');

    // 8. Cheque emitido cerrado (pagado/cobrado/etc.): no alerta
    const emPagado = alertas.find((a) => a.alerta_id.includes('ch-emitido-pagado'));
    expect(emPagado).toBeUndefined();
  });

  describe('Alertas de cheques en Tesorería - Casos de Prueba Reales', () => {
    const buildWithCheque = (cheque: any) => {
      return buildTesoreriaInsights(
        [] as never,
        [] as never,
        [] as never,
        [] as never,
        [] as never,
        [cheque] as never,
        100000,
      ).alertasTesoreria;
    };

    afterAll(() => {
      vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
    });

    it('Caso A: Recibido A DEPOSITAR con fecha futura -> NO genera alerta', () => {
      vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));
      const cheque = {
        id: '11111',
        numero: '11111',
        tipo: 'RECIBIDO',
        tercero: 'Cliente Test',
        importe: 15000,
        fecha_emision: '2026-06-01',
        fecha_vencimiento: '2026-07-07',
        estado: 'A_DEPOSITAR',
      };
      const alerts = buildWithCheque(cheque);
      const alert = alerts.find(a => a.alerta_id.includes('11111'));
      expect(alert).toBeUndefined();
    });

    it('Caso B: Recibido A DEPOSITAR con fecha actual (hoy) -> SÍ genera alerta listo para depositar', () => {
      vi.setSystemTime(new Date('2026-07-07T12:00:00Z'));
      const cheque = {
        id: '11111',
        numero: '11111',
        tipo: 'RECIBIDO',
        tercero: 'Cliente Test',
        importe: 15000,
        fecha_emision: '2026-06-01',
        fecha_vencimiento: '2026-07-07',
        estado: 'A_DEPOSITAR',
      };
      const alerts = buildWithCheque(cheque);
      const alert = alerts.find(a => a.alerta_id.includes('11111'));
      expect(alert).toBeDefined();
      expect(alert?.tipo).toBe('Cheque recibido listo para depositar');
    });

    it('Caso C: Recibido A DEPOSITAR con fecha vencida -> SÍ genera alerta vencido', () => {
      vi.setSystemTime(new Date('2026-07-08T12:00:00Z'));
      const cheque = {
        id: '11111',
        numero: '11111',
        tipo: 'RECIBIDO',
        tercero: 'Cliente Test',
        importe: 15000,
        fecha_emision: '2026-06-01',
        fecha_vencimiento: '2026-07-07',
        estado: 'A_DEPOSITAR',
      };
      const alerts = buildWithCheque(cheque);
      const alert = alerts.find(a => a.alerta_id.includes('11111'));
      expect(alert).toBeDefined();
      expect(alert?.tipo).toBe('Cheque recibido vencido');
    });

    it('Caso D: Recibido COBRADO con fecha vencida -> NO genera alerta', () => {
      vi.setSystemTime(new Date('2026-07-08T12:00:00Z'));
      const cheque = {
        id: '11111',
        numero: '11111',
        tipo: 'RECIBIDO',
        tercero: 'Cliente Test',
        importe: 15000,
        fecha_emision: '2026-06-01',
        fecha_vencimiento: '2026-07-07',
        estado: 'COBRADO',
      };
      const alerts = buildWithCheque(cheque);
      const alert = alerts.find(a => a.alerta_id.includes('11111'));
      expect(alert).toBeUndefined();
    });

    it('Caso E: Emitido con fecha de pago/vencimiento futura -> NO genera alerta', () => {
      vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));
      const cheque = {
        id: '22222',
        numero: '22222',
        tipo: 'EMITIDO',
        tercero: 'Proveedor Test',
        importe: 20000,
        fecha_emision: '2026-06-01',
        fecha_vencimiento: '2026-07-07',
        estado: 'PENDIENTE',
      };
      const alerts = buildWithCheque(cheque);
      const alert = alerts.find(a => a.alerta_id.includes('22222'));
      expect(alert).toBeUndefined();
    });
  });
});
