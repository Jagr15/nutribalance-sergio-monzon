import { ControlEstado, type MovimientoStockPT, type RegistrarSalidaStockPTData, type StockProductoTerminado, type StockProductoTerminadoResumen } from '../../../../features/productos/types';
import { buildStockPTResumen } from '../../../../features/productos/utils/stockPtResumen';
import { mockApiCall } from '../mockClient';

const seedClientes = new Map<string, string>([
  ['cli-001', 'Estancia La Esperanza'],
  ['cli-002', 'Agropecuaria Don Sergio'],
  ['cli-003', 'Tambo San Miguel'],
]);

const seedStockPT: StockProductoTerminado[] = [
  {
    uid: 'pt-001',
    id_orden: 'OP-PLD-001',
    numero_orden: 'OP-PLD-001',
    id_formula: 'form-001',
    version_formula: 1,
    nombre_producto: 'Lechera 13% PB alta energia',
    cantidad_total: 1800,
    cantidad_inicial: 1800,
    costo_unitario_estimado: 240.5,
    lote: 'PT-LE13-2605-A',
    unidad_medida: 'KG',
    estado: ControlEstado.OK,
    id_silo: 'silo-001',
    nombre_silo: 'Silo Lechera',
    detalle_insumos: {
      id_lote: 'I-3-2605-A',
      nombre_lote: 'I-3-2605-A',
      id_insumo: 'i-3',
      nombre_insumo: 'Maíz',
      cantidad: 975,
      unidad_medida: 'KG',
    },
    fecha_ingreso: '2026-05-26T09:00:00Z',
    usuario: 'Sergio Monzón',
    updateAt: '2026-05-26T12:00:00Z',
  },
  {
    uid: 'pt-002',
    id_orden: 'OP-PLD-002',
    numero_orden: 'OP-PLD-002',
    id_formula: 'form-002',
    version_formula: 1,
    nombre_producto: 'Lechera 18% PB',
    cantidad_total: 1200,
    cantidad_inicial: 1200,
    costo_unitario_estimado: 278.2,
    lote: 'PT-LE18-2605-B',
    unidad_medida: 'KG',
    estado: ControlEstado.BAJO,
    id_silo: 'silo-002',
    nombre_silo: 'Silo Producción 2',
    detalle_insumos: {
      id_lote: 'I-11-2605-A',
      nombre_lote: 'I-11-2605-A',
      id_insumo: 'i-11',
      nombre_insumo: 'Cáscara de Soja',
      cantidad: 729,
      unidad_medida: 'KG',
    },
    fecha_ingreso: '2026-05-27T11:30:00Z',
    usuario: 'Operador Planta',
    updateAt: '2026-05-27T14:10:00Z',
  },
  {
    uid: 'pt-003',
    id_orden: 'OP-PLD-003',
    numero_orden: 'OP-PLD-003',
    id_formula: 'form-003',
    version_formula: 2,
    nombre_producto: 'Engorde Smart',
    cantidad_total: 480,
    cantidad_inicial: 480,
    costo_unitario_estimado: 315.75,
    lote: 'PT-ENGS-2605-C',
    unidad_medida: 'KG',
    estado: ControlEstado.CRITICO,
    id_silo: 'silo-003',
    nombre_silo: 'Silo Engorde',
    detalle_insumos: {
      id_lote: 'I-6-2605-A',
      nombre_lote: 'I-6-2605-A',
      id_insumo: 'i-6',
      nombre_insumo: 'Afrechillo',
      cantidad: 248,
      unidad_medida: 'KG',
    },
    fecha_ingreso: '2026-05-28T10:00:00Z',
    usuario: 'Sergio Monzón',
    updateAt: '2026-05-28T10:35:00Z',
  },
];

let stockPTMock: StockProductoTerminado[] = structuredClone(seedStockPT);
let movimientosMock: MovimientoStockPT[] = [];
let nextUid = seedStockPT.length + 1;
let nextMovimiento = 1;

const nowIso = () => new Date().toISOString();

const normalizeSummary = (rows: StockProductoTerminadoResumen[]) =>
  rows.map((row) => ({
    ...row,
    valor_monetario: Number(row.valor_monetario ?? 0),
    stock_actual: Number(row.stock_actual ?? 0),
  }));

const pushMovimiento = (movimiento: Omit<MovimientoStockPT, 'id' | 'created_at'>) => {
  const createdAt = nowIso();
  const row: MovimientoStockPT = {
    ...movimiento,
    id: `pt-mov-${nextMovimiento++}`,
    created_at: createdAt,
  };
  movimientosMock = [row, ...movimientosMock];
  return row;
};

const buildSalidaMovimiento = (
  stock: StockProductoTerminado,
  cantidad: number,
  referencia: string,
  clienteId: string | null,
  motivo = 'Despacho de producto terminado'
): MovimientoStockPT => ({
  id: `seed-salida-${stock.uid}-${referencia}`,
  stock_pt_id: stock.uid,
  producto_id: stock.id_formula ?? stock.nombre_producto,
  nombre_producto: stock.nombre_producto,
  lote: stock.lote,
  numero_orden: stock.numero_orden,
  silo: stock.nombre_silo,
  tipo: 'SALIDA',
  cantidad,
  unidad: stock.unidad_medida,
  costo_unitario: stock.costo_unitario_estimado ?? null,
  valor_total: Number((cantidad * Number(stock.costo_unitario_estimado ?? 0)).toFixed(6)),
  motivo,
  referencia,
  cliente_id: clienteId,
  cliente_nombre: clienteId ? (seedClientes.get(clienteId) ?? 'Sin cliente asociado') : 'Sin cliente asociado',
  created_at: nowIso(),
});

const buildIngresoMovimiento = (stock: StockProductoTerminado): MovimientoStockPT => ({
  id: `seed-${stock.uid}`,
  stock_pt_id: stock.uid,
  producto_id: stock.id_formula ?? stock.nombre_producto,
  nombre_producto: stock.nombre_producto,
  lote: stock.lote,
  numero_orden: stock.numero_orden,
  silo: stock.nombre_silo,
  tipo: 'INGRESO',
  cantidad: Number(stock.cantidad_total ?? 0),
  unidad: stock.unidad_medida,
  costo_unitario: stock.costo_unitario_estimado ?? null,
  valor_total: Number(stock.cantidad_total ?? 0) * Number(stock.costo_unitario_estimado ?? 0),
  motivo: 'Ingreso inicial mock',
  referencia: stock.numero_orden,
  created_at: stock.fecha_ingreso,
});

const recomputeEstado = (stock: StockProductoTerminado) => {
  const inicial = Number(stock.cantidad_inicial ?? stock.cantidad_total);
  const saldo = Number(stock.cantidad_total ?? 0);
  if (inicial <= 0) return ControlEstado.OK;
  const ratio = saldo / inicial;
  if (ratio <= 0.2) return ControlEstado.CRITICO;
  if (ratio <= 0.4) return ControlEstado.BAJO;
  return ControlEstado.OK;
};

const resetMockStockPTState = () => {
  stockPTMock = structuredClone(seedStockPT);
  movimientosMock = seedStockPT.map(buildIngresoMovimiento);
  movimientosMock = [
    buildSalidaMovimiento(stockPTMock[0]!, 25, 'Salida demo PT 1', 'cli-001', 'Venta de producto terminado'),
    buildSalidaMovimiento(stockPTMock[1]!, 40, 'Salida demo PT 2', 'cli-002', 'Despacho a cliente'),
    buildSalidaMovimiento(stockPTMock[2]!, 18, 'Salida demo PT 3', null, 'Egreso sin cliente'),
    ...movimientosMock,
  ];
  nextUid = seedStockPT.length + 1;
  nextMovimiento = movimientosMock.length + 1;
};

resetMockStockPTState();

export const registerMockIngresoPT = (data: {
  id_orden: string;
  numero_orden: string;
  id_formula?: string | null;
  version_formula?: number | null;
  nombre_producto: string;
  cantidad_total: number;
  lote: string;
  unidad_medida?: StockProductoTerminado['unidad_medida'];
  id_silo?: string | null;
  nombre_silo?: string | null;
  detalle_insumos?: StockProductoTerminado['detalle_insumos'];
  usuario?: string | null;
  costo_unitario_estimado?: number | null;
}) => {
  const createdAt = nowIso();
  const stock: StockProductoTerminado = {
    uid: `pt-${String(nextUid++).padStart(3, '0')}`,
    id_orden: data.id_orden,
    numero_orden: data.numero_orden,
    id_formula: data.id_formula ?? null,
    version_formula: data.version_formula ?? null,
    nombre_producto: data.nombre_producto,
    cantidad_total: data.cantidad_total,
    cantidad_inicial: data.cantidad_total,
    costo_unitario_estimado: data.costo_unitario_estimado ?? null,
    lote: data.lote,
    unidad_medida: data.unidad_medida ?? 'KG',
    estado: ControlEstado.OK,
    id_silo: data.id_silo ?? '',
    nombre_silo: data.nombre_silo ?? '',
    detalle_insumos: data.detalle_insumos ?? seedStockPT[0].detalle_insumos,
    fecha_ingreso: createdAt,
    usuario: data.usuario ?? 'Sistema',
    updateAt: createdAt,
  };

  stockPTMock = [stock, ...stockPTMock];
  movimientosMock = [
    buildIngresoMovimiento(stock),
    ...movimientosMock,
  ];

  return stock;
};

export const resetMockStockPTService = resetMockStockPTState;

export const mockStockPTService = {
  getAll: async (): Promise<StockProductoTerminado[]> => mockApiCall([...stockPTMock], 450),

  getResumen: async (): Promise<StockProductoTerminadoResumen[]> => mockApiCall(
    normalizeSummary(buildStockPTResumen([...stockPTMock], [...movimientosMock])),
    350
  ),

  getMovimientos: async (): Promise<MovimientoStockPT[]> => mockApiCall([...movimientosMock], 350),

  registrarSalida: async (payload: RegistrarSalidaStockPTData): Promise<StockProductoTerminado> => {
    const index = stockPTMock.findIndex((item) => item.uid === payload.stock_pt_id);
    if (index === -1) {
      throw new Error('El stock PT no existe.');
    }

    const current = stockPTMock[index];
    if (payload.cantidad > Number(current.cantidad_total ?? 0)) {
      throw new Error('No hay saldo suficiente en el lote de PT.');
    }

    const nextSaldo = Number((Number(current.cantidad_total) - payload.cantidad).toFixed(3));
    const nextStock: StockProductoTerminado = {
      ...current,
      cantidad_total: nextSaldo,
      estado: recomputeEstado({ ...current, cantidad_total: nextSaldo }),
      updateAt: nowIso(),
    };

    stockPTMock[index] = nextStock;
    pushMovimiento({
      stock_pt_id: nextStock.uid,
      producto_id: nextStock.id_formula ?? nextStock.nombre_producto,
      nombre_producto: nextStock.nombre_producto,
      lote: nextStock.lote,
      numero_orden: nextStock.numero_orden,
      silo: nextStock.nombre_silo,
      tipo: 'SALIDA',
      cantidad: payload.cantidad,
      unidad: nextStock.unidad_medida,
      costo_unitario: nextStock.costo_unitario_estimado ?? null,
      valor_total: Number((payload.cantidad * Number(nextStock.costo_unitario_estimado ?? 0)).toFixed(6)),
      motivo: payload.motivo,
      referencia: payload.referencia ?? null,
      cliente_id: payload.cliente_id ?? null,
      cliente_nombre: payload.cliente_nombre ?? null,
    });

    return mockApiCall(nextStock, 300);
  },
};
