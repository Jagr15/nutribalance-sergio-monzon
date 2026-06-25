import type {
  ActualizarOrdenExpedicionPayload,
  OrdenExpedicion,
  RegistrarOrdenExpedicionPayload,
  PresentacionExpedicion,
} from '../../../../features/ordenes/types';
import { normalizeCantidadOrden } from '../../../../features/ordenes/utils/cantidad';
import { mockStockPTService } from './mockStockPTService';
import { applyMockSalidaAjuste } from './mockStockPTService';
import { mockApiCall } from '../mockClient';

const nowIso = () => new Date().toISOString();

// Build a synchronous name map from the known demo dataset.
const clienteNombreByUid = new Map<string, string>([
  ['cli-001', 'Estancia La Esperanza'],
  ['cli-002', 'Agropecuaria Don Sergio'],
  ['cli-003', 'Tambo San Miguel'],
]);

const presentacionByIndex = (idx: number): PresentacionExpedicion => (idx % 3 === 0 ? 'GRANEL' : idx % 3 === 1 ? 'BIG_BAG' : 'BOLSA');

let nextExpedition = 1;
let expedicionesDb: OrdenExpedicion[] = [];

const buildExpedicion = (input: {
  uid: string;
  numero: string;
  stock_pt_id: string;
  producto_id: string;
  nombre_producto: string;
  lote_pt: string;
  cliente_id: string | null;
  presentacion: PresentacionExpedicion;
  cantidad: number;
  cantidad_original: number;
  unidad_cantidad: 'kg' | 'tonelada';
  cantidad_kg: number;
  motivo: string | null;
  referencia: string | null;
  created_at: string;
}): OrdenExpedicion => ({
  id: input.uid,
  legacy_uid: input.uid,
  numero_expedicion: input.numero,
  stock_pt_id: input.stock_pt_id,
  producto_id: input.producto_id,
  nombre_producto: input.nombre_producto,
  lote_pt: input.lote_pt,
  cliente_id: input.cliente_id,
  cliente_nombre: input.cliente_id ? (clienteNombreByUid.get(input.cliente_id) ?? 'Sin cliente asociado') : 'Sin cliente asociado',
  presentacion: input.presentacion,
  cantidad: input.cantidad,
  cantidad_original: input.cantidad_original,
  unidad_cantidad: input.unidad_cantidad,
  cantidad_kg: input.cantidad_kg,
  estado: 'pendiente',
  motivo: input.motivo,
  referencia: input.referencia,
  created_at: input.created_at,
  updated_at: input.created_at,
});

const resetMockOrdenesExpedicionState = () => {
  const seedRows = [
    {
      stock_pt_id: 'pt-001',
      producto_id: 'form-001',
      nombre_producto: 'Lechera 13% PB alta energia',
      lote_pt: 'PT-LE13-2605-A',
      cliente_id: 'cli-001',
      cantidad: 120,
      referencia: 'EXP-2605-001',
    },
    {
      stock_pt_id: 'pt-001',
      producto_id: 'form-001',
      nombre_producto: 'Lechera 13% PB alta energia',
      lote_pt: 'PT-LE13-2605-A',
      cliente_id: 'cli-003',
      cantidad: 80,
      referencia: 'EXP-2605-002',
    },
    {
      stock_pt_id: 'pt-002',
      producto_id: 'form-002',
      nombre_producto: 'Lechera 18% PB',
      lote_pt: 'PT-LE18-2605-B',
      cliente_id: 'cli-002',
      cantidad: 60,
      referencia: 'EXP-2605-003',
    },
    {
      stock_pt_id: 'pt-003',
      producto_id: 'form-003',
      nombre_producto: 'Engorde Smart',
      lote_pt: 'PT-ENGS-2605-C',
      cliente_id: 'cli-002',
      cantidad: 40,
      referencia: 'EXP-2605-004',
    },
    {
      stock_pt_id: 'pt-003',
      producto_id: 'form-003',
      nombre_producto: 'Engorde Smart',
      lote_pt: 'PT-ENGS-2605-C',
      cliente_id: 'cli-001',
      cantidad: 32,
      referencia: 'EXP-2605-005',
    },
  ];

  expedicionesDb = seedRows.map((row, idx) => buildExpedicion({
    uid: `exp-${String(idx + 1).padStart(4, '0')}`,
    numero: `EXP-2026-${String(idx + 1).padStart(6, '0')}`,
    stock_pt_id: row.stock_pt_id,
    producto_id: row.producto_id,
    nombre_producto: row.nombre_producto,
    lote_pt: row.lote_pt,
    cliente_id: row.cliente_id,
    presentacion: presentacionByIndex(idx),
    cantidad: row.cantidad,
    cantidad_original: row.cantidad,
    unidad_cantidad: 'kg',
    cantidad_kg: row.cantidad,
    motivo: 'Despacho demo',
    referencia: row.referencia,
    created_at: new Date(Date.now() - (idx + 1) * 3600_000).toISOString(),
  }));

  nextExpedition = expedicionesDb.length + 1;
};

resetMockOrdenesExpedicionState();

export const resetMockOrdenesExpedicionService = resetMockOrdenesExpedicionState;

export const mockOrdenesExpedicionService = {
  getAll: async (): Promise<OrdenExpedicion[]> => mockApiCall([...expedicionesDb], 300),

  create: async (payload: RegistrarOrdenExpedicionPayload): Promise<OrdenExpedicion> => {
    if (!payload.cliente_id) {
      throw new Error('El cliente destino es obligatorio.');
    }
    const cantidad = normalizeCantidadOrden(payload.cantidad, payload.unidad_cantidad);

    const stockPt = (await mockStockPTService.getAll()).find((item) => item.uid === payload.stock_pt_id);
    if (!stockPt) {
      throw new Error('No se encontró el stock PT seleccionado.');
    }
    if (cantidad.cantidadKg > Number(stockPt.cantidad_total ?? 0)) {
      throw new Error('No hay saldo suficiente para expedir.');
    }

    const createdAt = nowIso();
    const expedicion = buildExpedicion({
      uid: `exp-${String(nextExpedition).padStart(4, '0')}`,
      numero: `EXP-2026-${String(nextExpedition).padStart(6, '0')}`,
      stock_pt_id: stockPt.uid,
      producto_id: stockPt.id_formula ?? stockPt.nombre_producto,
      nombre_producto: stockPt.nombre_producto,
      lote_pt: stockPt.lote,
      cliente_id: payload.cliente_id,
      presentacion: payload.presentacion,
      cantidad: cantidad.cantidadOriginal,
      cantidad_original: cantidad.cantidadOriginal,
      unidad_cantidad: cantidad.unidad,
      cantidad_kg: cantidad.cantidadKg,
      motivo: payload.motivo ?? null,
      referencia: payload.referencia ?? null,
      created_at: createdAt,
    });

    nextExpedition += 1;
    expedicionesDb = [expedicion, ...expedicionesDb];
    return mockApiCall(expedicion, 350);
  },

  update: async (id: string, payload: ActualizarOrdenExpedicionPayload): Promise<OrdenExpedicion> => {
    const index = expedicionesDb.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró la orden de salida.');
    const current = expedicionesDb[index];
    if (current.estado === 'despachada' || current.estado === 'cancelada') {
      throw new Error('La orden ya no puede editarse.');
    }
    const normalized = payload.cantidad !== undefined || payload.unidad_cantidad !== undefined
      ? normalizeCantidadOrden(payload.cantidad ?? current.cantidad_original, payload.unidad_cantidad ?? current.unidad_cantidad)
      : { cantidadOriginal: current.cantidad_original, unidad: current.unidad_cantidad, cantidadKg: current.cantidad_kg };

    const stock = (await mockStockPTService.getAll()).find((item) => item.uid === current.stock_pt_id);
    if (!stock) throw new Error('No se encontró el stock PT seleccionado.');

    const deltaKg = Number((normalized.cantidadKg - current.cantidad_kg).toFixed(3));
    if (deltaKg !== 0) {
      applyMockSalidaAjuste({
        stock_pt_id: stock.uid,
        deltaKg,
        motivo: payload.motivo ?? current.motivo ?? 'Expedición de producto terminado',
        referencia: payload.referencia ?? current.referencia ?? undefined,
        cliente_id: payload.cliente_id ?? current.cliente_id,
        cliente_nombre: payload.cliente_id ? (clienteNombreByUid.get(payload.cliente_id) ?? current.cliente_nombre ?? 'Sin cliente asociado') : current.cliente_nombre ?? 'Sin cliente asociado',
      });
    }

    const updated = {
      ...current,
      ...payload,
      cantidad: normalized.cantidadKg,
      cantidad_original: normalized.cantidadOriginal,
      unidad_cantidad: normalized.unidad,
      cantidad_kg: normalized.cantidadKg,
      updated_at: nowIso(),
    };
    expedicionesDb[index] = updated;
    return mockApiCall(updated, 350);
  },

  iniciarPreparacion: async (id: string): Promise<OrdenExpedicion> => {
    const index = expedicionesDb.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró la orden de salida.');
    const current = expedicionesDb[index];
    if (current.estado !== 'pendiente') throw new Error('Transición de estado inválida.');
    expedicionesDb[index] = { ...current, estado: 'preparando', updated_at: nowIso() };
    return mockApiCall(expedicionesDb[index], 250);
  },

  marcarLista: async (id: string): Promise<OrdenExpedicion> => {
    const index = expedicionesDb.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró la orden de salida.');
    const current = expedicionesDb[index];
    if (current.estado !== 'preparando') throw new Error('Transición de estado inválida.');
    expedicionesDb[index] = { ...current, estado: 'lista', updated_at: nowIso() };
    return mockApiCall(expedicionesDb[index], 250);
  },

  despachar: async (id: string): Promise<OrdenExpedicion> => {
    const index = expedicionesDb.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró la orden de salida.');
    const current = expedicionesDb[index];
    if (current.estado !== 'lista') throw new Error('Transición de estado inválida.');

    const stock = (await mockStockPTService.getAll()).find((item) => item.uid === current.stock_pt_id);
    if (!stock) throw new Error('No se encontró el stock PT seleccionado.');
    if (current.cantidad_kg > Number(stock.cantidad_total ?? 0)) {
      throw new Error('No hay saldo suficiente en el lote de PT.');
    }
    await mockStockPTService.registrarSalida({
      stock_pt_id: stock.uid,
      cantidad: current.cantidad_kg,
      motivo: current.motivo ?? 'Expedición de producto terminado',
      referencia: current.numero_expedicion,
      cliente_id: current.cliente_id,
      cliente_nombre: current.cliente_nombre ?? 'Sin cliente asociado',
    });
    expedicionesDb[index] = { ...current, estado: 'despachada', updated_at: nowIso() };
    return mockApiCall(expedicionesDb[index], 250);
  },

  cancelar: async (id: string): Promise<OrdenExpedicion> => {
    const index = expedicionesDb.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró la orden de salida.');
    const current = expedicionesDb[index];
    if (current.estado === 'cancelada') throw new Error('La orden ya fue cancelada.');
    expedicionesDb[index] = { ...current, estado: 'cancelada', updated_at: nowIso() };
    return mockApiCall(expedicionesDb[index], 250);
  },
};
