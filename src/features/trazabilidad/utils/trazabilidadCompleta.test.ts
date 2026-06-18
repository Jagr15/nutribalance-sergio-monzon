import { describe, expect, it } from 'vitest';
import type { Cliente } from '../../clientes/types/cliente';
import type { Formula } from '../../formulas/types';
import type { MovimientoStockPT } from '../../productos/types';
import type { TrazabilidadPorOP } from '../types';
import { buildTrazabilidadCompleta } from './trazabilidadCompleta';

describe('buildTrazabilidadCompleta', () => {
  const clientes: Cliente[] = [
    { uid: 'cli-001', nombre: 'Estancia La Esperanza', estado: 'Activo', saldoPendienteArs: 0, estaActivo: true },
  ];

  const formulas: Formula[] = [
    {
      uid: 'form-1',
      nombre_producto: 'Núcleo Inicio',
      version: 2,
      esta_activa: true,
      ingredientes: [],
      ultima_edicion: new Date('2026-06-18T00:00:00Z'),
      id_usuario: 'usr-1',
      author: 'Sistema',
      createdAt: new Date('2026-06-18T00:00:00Z'),
      proteina_calculada_pct: 18,
      costo_por_kg: 100,
      costo_por_tonelada: 100000,
    },
  ];

  const trazabilidadOP: TrazabilidadPorOP[] = [
    {
      op_id: 'op-1',
      orden_legacy_uid: 'OP-1',
      numero_orden: 'OP-1',
      producto: 'Núcleo Inicio',
      formula: 'form-1',
      version_formula: 2,
      estado_op: 'FINALIZADO',
      cantidad_objetivo: 100,
      cantidad_real: 98,
      merma_manual: 2,
      destino_silo: 'S1',
      usuario_responsable: 'usr-1',
      fecha_creacion: '2026-06-18T08:00:00Z',
      actualizada_en: '2026-06-18T09:00:00Z',
      mp_planificada: [
        { insumo: 'Maíz', lote_mp: 'MP-1', cantidad: 20, unidad: 'KG', costo_unitario: 1, costo_total: 20 },
        { insumo: 'Soja', lote_mp: 'MP-2', cantidad: 30, unidad: 'KG', costo_unitario: 2, costo_total: 60 },
      ],
      lotes_mp_usados: ['MP-1', 'MP-2'],
      mp_movimientos: [],
      pt_generado: [
        { stock_pt_id: 'pt-1', lote_pt: 'PT-1', cantidad: 100, unidad: 'KG', silo: 'S1', fecha: '2026-06-18T09:00:00Z' },
      ],
      salidas_pt: [],
      eventos: [],
    },
  ];

  const movimientos: MovimientoStockPT[] = [
    {
      id: 'm-1',
      stock_pt_id: 'pt-1',
      producto_id: 'form-1',
      nombre_producto: 'Núcleo Inicio',
      lote: 'PT-1',
      numero_orden: 'OP-1',
      silo: 'S1',
      tipo: 'SALIDA',
      cantidad: 40,
      unidad: 'KG',
      costo_unitario: 100,
      valor_total: 4000,
      motivo: 'Venta',
      referencia: 'R-1',
      cliente_id: 'cli-001',
      cliente_nombre: 'Estancia La Esperanza',
      created_at: '2026-06-18T10:00:00Z',
    },
  ];

  it('arma la cadena completa cliente -> insumos', () => {
    const rows = buildTrazabilidadCompleta(movimientos, trazabilidadOP, formulas, clientes);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cliente_nombre: 'Estancia La Esperanza',
      producto: 'Núcleo Inicio',
      lote_pt: 'PT-1',
      op: 'OP-1',
      formula: 'Núcleo Inicio',
      version_formula: 2,
      lotes_mp: ['MP-1', 'MP-2'],
      kg: 40,
      referencia: 'R-1',
    });
    expect(rows[0].insumos).toEqual(['Maíz (MP-1)', 'Soja (MP-2)']);
  });
});
