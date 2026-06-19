import { describe, expect, it } from 'vitest';
import type { Cliente } from '../../clientes/types/cliente';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import type { OrdenExpedicion, OrdenProduccion } from '../../ordenes/types';
import type { MovimientoStockPT } from '../../productos/types';
import type { Proveedor } from '../../proveedores/types/proveedor';
import type { TrazabilidadPorOP } from '../types';
import { buildTrazabilidadHistoria } from './trazabilidadHistoria';

describe('buildTrazabilidadHistoria', () => {
  const cliente: Cliente = { uid: 'cli-1', nombre: 'Cliente Demo', estado: 'Activo', saldoPendienteArs: 0, estaActivo: true };
  const insumo: Insumo = {
    uid: 'ins-1',
    nombre: 'Maíz',
    unidad_medida: 'KG',
    umbral_alerta: 100,
    categoria: 'Grano',
  } as Insumo;
  const proveedor: Proveedor = {
    uid: 'prov-1',
    nombre_empresa: 'Proveedor Norte',
    contacto_nombre: 'Ana',
    telefono: '123',
    email: 'a@b.com',
    direccion: 'Calle 1',
    esta_activo: true,
  };
  const lote: StockMateriaPrima = {
    uid: 'lote-1',
    id_insumo: 'ins-1',
    id_proveedor: 'prov-1',
    lote: 'MP-001',
    cantidad_actual: 120,
    cantidad_inicial: 150,
    costo_unitario: 10,
    costo_total: 1500,
    fecha_ingreso: new Date('2026-06-10T10:00:00Z'),
    remito_nro: 'REM-1',
    ubicacion: 'Depósito A',
    id_usuario: 'usr-1',
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
  } as StockMateriaPrima;
  const orden: OrdenProduccion = {
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
    detalle_insumos: [{ id_lote: 'MP-001', id_insumo: 'ins-1', nombre_insumo: 'Maíz', cantidad_usada: 50, tipo_unidad: 'KG', costo_unitario: 10, costo_total: 500 }],
    costo_total_insumos: 500,
  };
  const trazabilidadOP: TrazabilidadPorOP[] = [{
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
    mp_planificada: [{ insumo: 'Maíz', lote_mp: 'MP-001', cantidad: 50, unidad: 'KG', costo_unitario: 10, costo_total: 500 }],
    lotes_mp_usados: ['MP-001'],
    mp_movimientos: [],
    pt_generado: [{ stock_pt_id: 'pt-1', lote_pt: 'PT-1', cantidad: 96, unidad: 'KG', silo: 'Silo 1', fecha: '2026-06-11T11:00:00Z' }],
    salidas_pt: [],
    eventos: [],
  }];
  const movimientosPT: MovimientoStockPT[] = [{
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
    referencia: 'EXP-1',
    cliente_id: 'cli-1',
    cliente_nombre: 'Cliente Demo',
    created_at: '2026-06-12T10:00:00Z',
  }];
  const expedicion: OrdenExpedicion = {
    id: 'exp-1',
    legacy_uid: 'exp-1',
    numero_expedicion: 'EXP-1',
    stock_pt_id: 'pt-1',
    producto_id: 'form-1',
    nombre_producto: 'Producto Final',
    lote_pt: 'PT-1',
    cliente_id: 'cli-1',
    cliente_nombre: 'Cliente Demo',
    presentacion: 'GRANEL',
    cantidad: 20,
    estado: 'REGISTRADA',
    motivo: 'Despacho',
    referencia: 'PED-1',
    created_at: '2026-06-12T10:00:00Z',
    updated_at: '2026-06-12T10:00:00Z',
  };

  it('construye trazabilidad hacia adelante', () => {
    const result = buildTrazabilidadHistoria(
      { sentido: 'ADELANTE', loteInsumo: 'MP-001' },
      { lotes: [lote], insumos: [insumo], ordenes: [orden], trazabilidadOP, movimientosPT, expediciones: [expedicion], clientes: [cliente], proveedores: [proveedor] },
    );

    expect(result).not.toBeNull();
    expect(result?.sentido).toBe('ADELANTE');
    expect(result?.movimientos.map((m) => m.tipo)).toEqual(['INGRESO_MP', 'CONSUMO_MP', 'INGRESO_PT', 'SALIDA']);
    expect(result?.trazabilidad_completa).toBe(true);
  });

  it('construye trazabilidad hacia atrás desde la venta', () => {
    const result = buildTrazabilidadHistoria(
      { sentido: 'ATRAS', venta: 'EXP-1' },
      { lotes: [lote], insumos: [insumo], ordenes: [orden], trazabilidadOP, movimientosPT, expediciones: [expedicion], clientes: [cliente], proveedores: [proveedor] },
    );

    expect(result).not.toBeNull();
    expect(result?.sentido).toBe('ATRAS');
    expect(result?.movimientos[0]?.tipo).toBe('INGRESO_MP');
    expect(result?.movimientos.at(-1)?.tipo).toBe('SALIDA');
    expect(result?.movimientos.some((m) => m.cliente === 'Cliente Demo')).toBe(true);
  });
});
