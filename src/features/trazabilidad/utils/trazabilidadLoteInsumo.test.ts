import { describe, expect, it } from 'vitest';
import type { Cliente } from '../../clientes/types/cliente';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import type { Proveedor } from '../../proveedores/types/proveedor';
import type { MovimientoStockPT } from '../../productos/types';
import type { OrdenProduccion } from '../../ordenes/types';
import type { TrazabilidadPorOP } from '../types';
import { buildTrazabilidadLoteInsumo } from './trazabilidadLoteInsumo';

describe('buildTrazabilidadLoteInsumo', () => {
  const lote: StockMateriaPrima = {
    uid: 'lote-mp-1',
    id_insumo: 'ins-1',
    id_proveedor: 'prov-1',
    lote: 'MP-001',
    cantidad_actual: 120,
    cantidad_inicial: 150,
    costo_unitario: 10,
    costo_total: 1500,
    fecha_ingreso: new Date('2026-06-10T10:00:00Z'),
    remito_nro: 'R-1',
    ubicacion: 'Depósito A',
    id_usuario: 'usr-1',
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
  } as StockMateriaPrima;

  const insumos: Insumo[] = [
    {
      uid: 'ins-1',
      nombre: 'Maíz',
      unidad_medida: 'KG',
      umbral_alerta: 100,
      categoria: 'Grano',
    },
  ] as Insumo[];

  const proveedores: Proveedor[] = [
    {
      uid: 'prov-1',
      nombre_empresa: 'Proveedor Norte',
      contacto_nombre: 'Ana',
      telefono: '123',
      email: 'a@b.com',
      direccion: 'Calle 1',
      esta_activo: true,
    },
  ] as Proveedor[];

  const ordenes: OrdenProduccion[] = [
    {
      id: 'OP-1',
      lote: 'OP-1',
      id_formula: 'form-1',
      nombre_producto: 'Producto Final',
      version_formula: 1,
      cantidad_objetivo: 100,
      estado: 'FINALIZADO',
      fecha_creacion: '2026-06-11T10:00:00Z',
      usuario_responsable: 'usr-1',
      id_silo: null,
      destino_silo: 'Silo 1',
      detalle_insumos: [
        { id_lote: 'MP-001', id_insumo: 'ins-1', nombre_insumo: 'Maíz', cantidad_usada: 50, tipo_unidad: 'KG', costo_unitario: 10, costo_total: 500 },
      ],
      costo_total_insumos: 500,
      cantidad_real: 96,
      merma_manual: 4,
    },
  ] as OrdenProduccion[];

  const trazabilidadOP: TrazabilidadPorOP[] = [
    {
      op_id: 'op-1',
      orden_legacy_uid: 'OP-1',
      numero_orden: 'OP-1',
      producto: 'Producto Final',
      formula: 'form-1',
      version_formula: 1,
      estado_op: 'FINALIZADO',
      cantidad_objetivo: 100,
      cantidad_real: 96,
      merma_manual: 4,
      destino_silo: 'Silo 1',
      usuario_responsable: 'usr-1',
      fecha_creacion: '2026-06-11T10:00:00Z',
      actualizada_en: '2026-06-11T11:00:00Z',
      mp_planificada: [
        { insumo: 'Maíz', lote_mp: 'MP-001', cantidad: 50, unidad: 'KG', costo_unitario: 10, costo_total: 500 },
      ],
      lotes_mp_usados: ['MP-001'],
      mp_movimientos: [],
      pt_generado: [
        { stock_pt_id: 'pt-1', lote_pt: 'PT-1', cantidad: 96, unidad: 'KG', silo: 'Silo 1', fecha: '2026-06-11T11:00:00Z' },
      ],
      salidas_pt: [],
      eventos: [],
    },
  ];

  const movimientosPT: MovimientoStockPT[] = [
    {
      id: 'mov-1',
      stock_pt_id: 'pt-1',
      producto_id: 'form-1',
      nombre_producto: 'Producto Final',
      lote: 'PT-1',
      numero_orden: 'OP-1',
      silo: 'Silo 1',
      tipo: 'SALIDA',
      cantidad: 20,
      unidad: 'KG',
      costo_unitario: 10,
      valor_total: 200,
      motivo: 'Venta',
      referencia: 'Pedido 1',
      cliente_id: 'cli-1',
      cliente_nombre: 'Cliente Final',
      created_at: '2026-06-12T10:00:00Z',
    },
  ];

  const clientes: Cliente[] = [
    { uid: 'cli-1', nombre: 'Cliente Final', estado: 'Activo', saldoPendienteArs: 0, estaActivo: true },
  ];

  it('arma la cadena completa desde el lote de insumo', () => {
    const result = buildTrazabilidadLoteInsumo('lote-mp-1', {
      lotes: [lote],
      insumoById: new Map(insumos.map((insumo) => [insumo.uid, insumo.nombre])),
      proveedoresById: new Map(proveedores.map((proveedor) => [proveedor.uid, proveedor])),
      ordenes,
      trazabilidadOP,
      movimientosPT,
      clientes,
    });

    expect(result).not.toBeNull();
    expect(result?.lote_insumo.lote).toBe('MP-001');
    expect(result?.lote_insumo.insumo_nombre).toBe('Maíz');
    expect(result?.lote_insumo.proveedor_nombre).toBe('Proveedor Norte');
    expect(result?.usos).toHaveLength(1);
    expect(result?.usos[0]).toMatchObject({
      orden_lote: 'OP-1',
      producto: 'Producto Final',
      lote_pt: 'PT-1',
    });
    expect(result?.usos[0].ventas).toHaveLength(1);
    expect(result?.usos[0].ventas[0]).toMatchObject({
      cliente_nombre: 'Cliente Final',
      referencia: 'Pedido 1',
    });
    expect(result?.trazabilidad_completa).toBe(true);
  });

  it('marca advertencias cuando falta un eslabón', () => {
    const result = buildTrazabilidadLoteInsumo('lote-mp-1', {
      lotes: [lote],
      insumoById: new Map(insumos.map((insumo) => [insumo.uid, insumo.nombre])),
      proveedoresById: new Map(),
      ordenes: [],
      trazabilidadOP: [],
      movimientosPT: [],
      clientes,
    });

    expect(result).not.toBeNull();
    expect(result?.advertencias.length).toBeGreaterThan(0);
    expect(result?.trazabilidad_completa).toBe(false);
  });
});
