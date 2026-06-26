import { afterAll, describe, expect, it, vi } from 'vitest';

const { mockFrom, mockApiService } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockApiService: (() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
    return {
      stockMP: {
        getAllLotes: vi.fn().mockResolvedValue([
          { id_insumo: 'i-1', cantidad_actual: 10 },
          { id_insumo: 'i-2', cantidad_actual: 5 },
        ]),
      },
      insumos: {
        getAllInsumos: vi.fn().mockResolvedValue([
          { uid: 'i-1', nombre: 'Maíz', costo_por_kg: 2 },
          { uid: 'i-2', nombre: 'Soja', costo_por_kg: 4 },
        ]),
      },
      stockPT: {
        getResumen: vi.fn().mockResolvedValue([
          { valor_monetario: 30 },
          { valor_monetario: 70 },
        ]),
        getMovimientos: vi.fn().mockResolvedValue([
          {
            id: 'pt-mov-1',
            stock_pt_id: 'pt-1',
            producto_id: 'form-1',
            nombre_producto: 'Pellet Crecimiento',
            lote: 'L-1',
            numero_orden: 'OP-1',
            silo: 'Silo 1',
            tipo: 'SALIDA',
            cantidad: 60,
            unidad: 'KG',
            costo_unitario: 360,
            valor_total: 21600,
            motivo: 'Venta',
            referencia: 'FAC-001',
            cliente_id: 'cli-1',
            cliente_nombre: 'Estancia La Esperanza',
            created_at: '2026-06-18T10:00:00Z',
          },
        ]),
      },
      ordenes: {
        getAll: vi.fn().mockResolvedValue([
          {
            fecha_creacion: '2026-06-10T10:00:00Z',
            costo_total_insumos: 5000,
            merma_manual: 0,
            cantidad_objetivo: 100,
            cantidad_real: 95,
            id_formula: 'form-1',
            nombre_producto: 'Pellet Crecimiento',
          },
        ]),
      },
      formulas: {
        findAll: vi.fn().mockResolvedValue([
          { uid: 'form-1', nombre_producto: 'Pellet Crecimiento', costo_por_kg: 320 },
        ]),
      },
      clientes: {
        getAll: vi.fn().mockResolvedValue([
          { uid: 'cli-1', nombre: 'Estancia La Esperanza', estado: 'Activo', saldoPendienteArs: 0, estaActivo: true, ultimaCompra: '2026-06-18T10:00:00Z' },
        ]),
      },
    };
  })(),
}));

vi.mock('../../../infrastructure/api', () => ({ ApiService: mockApiService }));
vi.mock('../../../infrastructure/api/supabase/client', () => ({ supabaseClient: { from: mockFrom } }));

import { finanzasService } from './finanzasService';

afterAll(() => {
  vi.useRealTimers();
});

describe('finanzasService inventory', () => {
  it('separa valor de stock MP y PT', async () => {
    const resumen = await finanzasService.getInventarioResumen();

    expect(resumen.valor_stock_mp).toBe(40);
    expect(resumen.valor_stock_pt).toBe(100);
    expect(resumen.valor_inventario_total).toBe(140);
  });

  it('convierte la salida de PT con cliente en ingreso financiero y cartera', async () => {
    const result = await finanzasService.getOperationalFallback();

    expect(result.reportes.ingresos_pt_por_producto[0]).toMatchObject({
      producto: 'Pellet Crecimiento',
      cantidad_kg: 60,
      importe_total: 21600,
      clientes_count: 1,
    });
    expect(result.tesoreria.carteraClientes[0]).toMatchObject({
      cliente_nombre: 'Estancia La Esperanza',
      saldo_pendiente: 21600,
    });
    expect(result.kpis.ingresos_mes).toBeGreaterThan(0);
    expect(result.kpis.cuentas_por_cobrar).toBeGreaterThan(0);
    expect(result.reportes.flujo_caja_mensual.some((row) => row.ingresos > 0)).toBe(true);
  });
});
