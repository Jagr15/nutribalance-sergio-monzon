import { describe, expect, it } from 'vitest';
import type { OrdenExpedicion } from '../types';
import { cancelarOrdenExpedicionEnLista, actualizarOrdenExpedicionEnLista } from '../utils/ordenesExpedicion';

const baseOrden = (id: string, estado: OrdenExpedicion['estado']): OrdenExpedicion => ({
  id,
  legacy_uid: `exp-${id}`,
  numero_expedicion: 'EXP-2026-000030',
  stock_pt_id: 'pt-1',
  producto_id: 'prod-1',
  nombre_producto: 'Producto 1',
  lote_pt: 'L-1',
  cliente_id: 'cli-1',
  cliente_nombre: 'Cliente Demo',
  presentacion: 'GRANEL',
  cantidad: 1,
  cantidad_original: 1,
  unidad_cantidad: 'kg',
  cantidad_kg: 1,
  estado: estado as OrdenExpedicion['estado'],
  motivo: 'Venta',
  referencia: 'R-1',
  created_at: '2026-06-18T10:00:00Z',
  updated_at: '2026-06-18T10:00:00Z',
});

describe('actualizarOrdenExpedicionEnLista', () => {
  it('reemplaza inmediatamente la orden cancelada en la tabla local', () => {
    const ordenes = [baseOrden('id-1', 'lista'), baseOrden('id-2', 'pendiente')];
    const cancelada: OrdenExpedicion = { ...baseOrden('id-1', 'lista'), estado: 'cancelada', updated_at: '2026-06-18T10:05:00Z' };

    const next = actualizarOrdenExpedicionEnLista(ordenes, cancelada);

    expect(next).toHaveLength(2);
    expect(next.find((orden) => orden.id === 'id-1')?.estado).toBe('cancelada');
    expect(next.find((orden) => orden.id === 'id-1')?.updated_at).toBe('2026-06-18T10:05:00Z');
    expect(next.find((orden) => orden.id === 'id-2')?.estado).toBe('pendiente');
  });

  it('aplica cancelación local aunque la RPC no devuelva la fila', () => {
    const ordenes = [baseOrden('id-1', 'pendiente')];
    const next = cancelarOrdenExpedicionEnLista(ordenes, 'id-1', null);

    expect(next[0].estado).toBe('cancelada');
  });
});
