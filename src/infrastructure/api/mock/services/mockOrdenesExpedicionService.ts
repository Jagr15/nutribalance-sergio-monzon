import type {
  OrdenExpedicion,
  RegistrarOrdenExpedicionPayload,
  PresentacionExpedicion,
} from '../../../../features/ordenes/types';
import { mockStockPTService } from './mockStockPTService';
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
  estado: 'REGISTRADA',
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
    if (payload.cantidad <= 0) {
      throw new Error('La cantidad a expedir debe ser mayor a 0.');
    }

    const stockPt = (await mockStockPTService.getAll()).find((item) => item.uid === payload.stock_pt_id);
    if (!stockPt) {
      throw new Error('No se encontró el stock PT seleccionado.');
    }
    if (payload.cantidad > Number(stockPt.cantidad_total ?? 0)) {
      throw new Error('No hay saldo suficiente para expedir.');
    }

    await mockStockPTService.registrarSalida({
      stock_pt_id: stockPt.uid,
      cantidad: payload.cantidad,
      motivo: payload.motivo ?? 'Expedición de producto terminado',
      referencia: payload.referencia ?? undefined,
      cliente_id: payload.cliente_id,
      cliente_nombre: clienteNombreByUid.get(payload.cliente_id) ?? 'Sin cliente asociado',
    });

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
      cantidad: payload.cantidad,
      motivo: payload.motivo ?? null,
      referencia: payload.referencia ?? null,
      created_at: createdAt,
    });

    nextExpedition += 1;
    expedicionesDb = [expedicion, ...expedicionesDb];
    return mockApiCall(expedicion, 350);
  },
};
