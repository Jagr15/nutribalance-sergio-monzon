import { describe, expect, it } from 'vitest';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import { TipoUnidad } from '../../../shared/types/global.interface';
import { compareFormulaDrafts, buildFormulaCreatePayloadFromDraft, buildFormulaDraftSnapshot, type FormulaDraftState } from './formulaComparisonBuilder';

const maestroInsumos: Insumo[] = [
  { uid: 'i-1', nombre: 'Maíz', unidad_medida: TipoUnidad.KG, umbral_alerta: 0, categoria: 'Grano', proteina_bruta_pct: 8, ref_costo_unitario: 120 },
  { uid: 'i-2', nombre: 'Soja', unidad_medida: TipoUnidad.KG, umbral_alerta: 0, categoria: 'Suplemento', proteina_bruta_pct: 45, ref_costo_unitario: 260 },
  { uid: 'i-3', nombre: 'Núcleo', unidad_medida: TipoUnidad.KG, umbral_alerta: 0, categoria: 'Aditivo', proteina_bruta_pct: 20 },
];

const maestroStock: StockMateriaPrima[] = [
  { uid: 'l-1', id_insumo: 'i-1', id_proveedor: 'p-1', lote: '1', cantidad_actual: 1, cantidad_inicial: 1, costo_unitario: 100, costo_total: 100, fecha_ingreso: new Date('2026-01-01T00:00:00Z'), remito_nro: '1', ubicacion: 'S1', id_usuario: 'u', createdAt: new Date(), updatedAt: new Date() },
  { uid: 'l-2', id_insumo: 'i-2', id_proveedor: 'p-1', lote: '2', cantidad_actual: 1, cantidad_inicial: 1, costo_unitario: 200, costo_total: 200, fecha_ingreso: new Date('2026-01-01T00:00:00Z'), remito_nro: '2', ubicacion: 'S1', id_usuario: 'u', createdAt: new Date(), updatedAt: new Date() },
];

const draftA: FormulaDraftState = {
  id: 'a',
  nombre_producto: 'Alternativa A',
  esta_activa: true,
  ingredientes: [
    { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 70 },
    { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 30 },
  ],
};

const draftB: FormulaDraftState = {
  id: 'b',
  nombre_producto: 'Alternativa B',
  esta_activa: false,
  ingredientes: [
    { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 60 },
    { id_insumo: 'i-3', nombre_insumo: 'Núcleo', porcentaje: 40 },
  ],
};

const env = {
  maestroInsumos,
  maestroStock,
  currentUser: { id: 'usr-9', name: 'Tester' },
};

describe('formulaComparisonBuilder', () => {
  it('compara dos borradores y calcula diferencias en vivo', () => {
    const result = compareFormulaDrafts(draftA, draftB, env);
    const snapshotB = buildFormulaDraftSnapshot(draftB, env, 'draft-b');

    expect(result.formulaA.nombre_producto).toBe('Alternativa A');
    expect(result.diferencias.proteina_formula).toBeLessThan(0);
    expect(result.ingredientes.some((row) => row.id_insumo === 'i-3')).toBe(true);
    expect(snapshotB.esta_activa).toBe(false);
  });

  it('construye un payload guardable para un borrador', () => {
    const payload = buildFormulaCreatePayloadFromDraft(draftA, env);

    expect(payload.nombre_producto).toBe('ALTERNATIVA A');
    expect(payload.version).toBe(1);
    expect(payload.ingredientes).toHaveLength(2);
    expect(payload.costo_por_kg).toBeGreaterThan(0);
  });
});
