import { describe, expect, it } from 'vitest';
import { TipoUnidad } from '../../../shared/types/global.interface';
import type { StockMateriaPrima } from '../types';
import { buildHistorialCompras, buildUltimosPrecios } from './compras';

const baseLotes: StockMateriaPrima[] = [
  {
    uid: 'stk-1',
    id_insumo: 'i-1',
    id_proveedor: 'p-1',
    lote: 'L-001',
    cantidad_actual: 100,
    cantidad_inicial: 100,
    cantidad_comprometida: 0,
    costo_unitario: 10,
    costo_total: 1000,
    fecha_ingreso: new Date('2026-06-10T10:00:00Z'),
    remito_nro: 'R-1',
    ubicacion: 'Silo 1',
    id_usuario: 'usr-1',
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
  },
  {
    uid: 'stk-2',
    id_insumo: 'i-1',
    id_proveedor: 'p-1',
    lote: 'L-002',
    cantidad_actual: 100,
    cantidad_inicial: 100,
    cantidad_comprometida: 0,
    costo_unitario: 12,
    costo_total: 1200,
    fecha_ingreso: new Date('2026-06-12T10:00:00Z'),
    remito_nro: 'R-2',
    ubicacion: 'Silo 1',
    id_usuario: 'usr-1',
    createdAt: new Date('2026-06-12T10:00:00Z'),
    updatedAt: new Date('2026-06-12T10:00:00Z'),
  },
  {
    uid: 'stk-3',
    id_insumo: 'i-2',
    id_proveedor: 'p-2',
    lote: 'L-003',
    cantidad_actual: 50,
    cantidad_inicial: 50,
    cantidad_comprometida: 0,
    costo_unitario: 20,
    costo_total: 1000,
    fecha_ingreso: new Date('2026-06-11T10:00:00Z'),
    remito_nro: 'R-3',
    ubicacion: 'Silo 2',
    id_usuario: 'usr-1',
    createdAt: new Date('2026-06-11T10:00:00Z'),
    updatedAt: new Date('2026-06-11T10:00:00Z'),
  },
];

const insumos = [
  { uid: 'i-1', nombre: 'Maiz', unidad_medida: TipoUnidad.KG, umbral_alerta: 100 },
  { uid: 'i-2', nombre: 'Soja', unidad_medida: TipoUnidad.KG, umbral_alerta: 50 },
];

const proveedores = [
  { uid: 'p-1', nombre_empresa: 'Proveedor Uno' },
  { uid: 'p-2', nombre_empresa: 'Proveedor Dos' },
];

describe('compras utils', () => {
  it('construye historial de compras ordenado por fecha descendente', () => {
    const historial = buildHistorialCompras(baseLotes, insumos, proveedores);
    expect(historial).toHaveLength(3);
    expect(historial[0].lote).toBe('L-002');
    expect(historial[0].proveedor).toBe('Proveedor Uno');
    expect(historial[0].insumo).toBe('Maiz');
  });

  it('calcula ultimo precio y variacion versus compra anterior', () => {
    const ultimos = buildUltimosPrecios(baseLotes, insumos, proveedores);
    const maiz = ultimos.find((item) => item.id_insumo === 'i-1');

    expect(maiz).toBeDefined();
    expect(maiz?.ultimo_precio).toBe(12);
    expect(maiz?.precio_compra_anterior).toBe(10);
    expect(maiz?.variacion_absoluta).toBe(2);
    expect(maiz?.variacion_pct).toBeCloseTo(20, 2);
  });
});
