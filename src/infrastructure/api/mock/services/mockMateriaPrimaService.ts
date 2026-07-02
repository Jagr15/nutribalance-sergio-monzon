import type {
  HistorialCompraMP,
  StockMateriaPrima,
  StockMateriaPrimaResumen,
  UltimoPrecioPagadoInsumo,
} from '../../../../features/insumos/types';
import { buildHistorialCompras, buildUltimosPrecios } from '../../../../features/insumos/utils/compras';
import { buildStockMPResumen } from '../../../../features/insumos/utils/stockResumen';
import { resolverCostoIngresoMP } from '../../../../features/insumos/utils/costoIngreso';
import type { DetalleInsumoLote } from '../../../../features/ordenes/types';
import { type Movimiento, TipoMovimiento, OrigenMovimiento } from "../../../../features/movimientos/types";
import { TipoUnidad } from "../../../../shared/types/global.interface";
import insumosData from '../data/insumos.json';
import proveedoresData from '../data/proveedores.json';
import initialDataRaw from "../data/stockMateriaPrima.json";

type StockMateriaPrimaRaw = Omit<StockMateriaPrima, 'fecha_ingreso' | 'createdAt' | 'updatedAt' | 'operaciones'> & {
  fecha_ingreso: string;
  createdAt: string;
  updatedAt: string;
  operaciones?: Omit<NonNullable<StockMateriaPrima['operaciones']>, 'fecha'> & { fecha: string };
};

// Convertimos las strings del JSON a objetos Date reales
const initialData: StockMateriaPrima[] = (initialDataRaw as unknown as StockMateriaPrimaRaw[]).map(item => ({
  ...item,
  fecha_ingreso: new Date(item.fecha_ingreso),
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt),
  // Mapeamos la operación solo si ya existe en el histórico del JSON
  operaciones: item.operaciones ? {
    ...item.operaciones,
    fecha: new Date(item.operaciones.fecha)
  } : undefined,
  stock_transito: item.stock_transito ? {
    ...item.stock_transito,
    cantidad: Number(item.stock_transito.cantidad)
  } : undefined
})) as StockMateriaPrima[];

let stockDB: StockMateriaPrima[] = [...initialData];
const mockInsumos = insumosData as unknown as Array<{
  uid: string;
  nombre?: string;
  unidad_medida?: string;
  umbral_alerta?: number | null;
  costo?: number | null;
  costo_por_kg?: number | null;
  ref_costo_unitario?: number | null;
}>;
const mockProveedores = proveedoresData as unknown as Array<{ uid: string; nombre_empresa?: string }>;
const movimientosDB: Movimiento[] = [];

const parseLocalDateForBusinessDay = (value: string | Date) => {
  if (value instanceof Date) return value;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(value);
  }

  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
};

export const getMockStockSnapshot = () => ({
  stockDB: structuredClone(stockDB),
  movimientosDB: structuredClone(movimientosDB),
});

export const resetMockMateriaPrimaService = () => {
  stockDB = [...initialData];
  movimientosDB.length = 0;
};

export const restoreMockStockSnapshot = (snapshot: {
  stockDB: StockMateriaPrima[];
  movimientosDB: Movimiento[];
}) => {
  stockDB = structuredClone(snapshot.stockDB);
  movimientosDB.length = 0;
  movimientosDB.push(...structuredClone(snapshot.movimientosDB));
};

const findLoteIndexByReference = (reference: string) => {
  const normalized = reference.trim().toUpperCase();
  return stockDB.findIndex((lote) => {
    const loteInsumoId = lote.insumo_id ?? lote.id_insumo;
    return lote.uid === reference || lote.lote.toUpperCase() === normalized || loteInsumoId === reference;
  });
};

const applyDetalleToStock = (
  detalle: DetalleInsumoLote[],
  mode: 'reserve' | 'release' | 'consume',
  ordenId?: string,
  factor = 1
) => {
  const planned = detalle.map((item) => {
    const loteIndex = findLoteIndexByReference(item.id_lote);
    if (loteIndex === -1) {
      throw new Error(`Lote no encontrado para ${item.nombre_insumo || item.id_insumo}.`);
    }

    const lote = stockDB[loteIndex];
    const cantidad = Number(item.cantidad_usada);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(`Cantidad inválida para ${item.nombre_insumo || item.id_insumo}.`);
    }

    const comprometidoActual = Number(lote.cantidad_comprometida || 0);
    const disponible = Number(lote.cantidad_actual) - comprometidoActual;

    if (mode === 'reserve' && disponible + 0.0001 < cantidad) {
      throw new Error(`Stock insuficiente para ${item.nombre_insumo || item.id_insumo}.`);
    }

    const consumo = mode === 'consume' ? Number((cantidad * factor).toFixed(3)) : cantidad;

    if (mode === 'consume' && Number(lote.cantidad_actual) + 0.0001 < consumo) {
      throw new Error(`Stock insuficiente para consumir ${item.nombre_insumo || item.id_insumo}.`);
    }

    return { loteIndex, cantidad, consumo };
  });

  planned.forEach(({ loteIndex, cantidad, consumo }) => {
    const lote = stockDB[loteIndex];
    const committed = Number(lote.cantidad_comprometida || 0);

    if (mode === 'reserve') {
      stockDB[loteIndex] = {
        ...lote,
        cantidad_comprometida: committed + cantidad,
        updatedAt: new Date(),
      };
      return;
    }

    if (mode === 'release') {
      stockDB[loteIndex] = {
        ...lote,
        cantidad_comprometida: Math.max(0, committed - cantidad),
        updatedAt: new Date(),
      };
      return;
    }

    stockDB[loteIndex] = {
      ...lote,
      cantidad_actual: Math.max(0, Number(lote.cantidad_actual) - consumo),
      cantidad_comprometida: Math.max(0, committed - cantidad),
      updatedAt: new Date(),
    };

    movimientosDB.push({
      uid: `mov-sal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fecha: new Date(),
      id_usuario: lote.id_usuario,
      tipo: TipoMovimiento.SALIDA,
      origen: OrigenMovimiento.PRODUCCION,
      id_entidad: ordenId ?? lote.id_insumo,
      nombre_entidad: `Consumo OP ${ordenId ?? 'MODO DEMO'}`,
      cantidad: consumo,
      lote_afectado: lote.lote,
    });
  });
};

export const reserveStockForDetalle = (detalle: DetalleInsumoLote[], ordenId?: string) => {
  applyDetalleToStock(detalle, 'reserve', ordenId);
};

export const releaseStockForDetalle = (detalle: DetalleInsumoLote[], ordenId?: string) => {
  applyDetalleToStock(detalle, 'release', ordenId);
};

export const consumeStockForDetalle = (detalle: DetalleInsumoLote[], ordenId?: string, factor = 1) => {
  applyDetalleToStock(detalle, 'consume', ordenId, factor);
};

export const mockMateriaPrimaService = {
  
  async getAllLotes(): Promise<StockMateriaPrima[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...stockDB]), 500);
    });
  },

  async getResumen(): Promise<StockMateriaPrimaResumen[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(buildStockMPResumen(stockDB, mockInsumos)), 300);
    });
  },

  async getHistorialCompras(): Promise<HistorialCompraMP[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(buildHistorialCompras(stockDB, mockInsumos, mockProveedores)), 250);
    });
  },

  async getUltimosPrecios(): Promise<UltimoPrecioPagadoInsumo[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(buildUltimosPrecios(stockDB, mockInsumos, mockProveedores)), 250);
    });
  },

  async create(data: {
    id_insumo: string;
    id_proveedor: string;
    lote: string;
    remito_nro: string;
    cantidad: number;
    unidad_entrada: TipoUnidad;
    precio_unitario?: number;
    unidad_precio?: 'KG' | 'TON';
    costo_total?: number;
    costo_unitario?: number;
    id_usuario: string;
    fecha_ingreso: Date;
    ubicacion: string; 
  }): Promise<StockMateriaPrima> {
    
    return new Promise((resolve) => {
      const insumo = mockInsumos.find((item) => item.uid === data.id_insumo);
      const costo = resolverCostoIngresoMP({
        cantidad: data.cantidad,
        unidad_entrada: data.unidad_entrada,
        costo_unitario: data.costo_unitario ?? data.precio_unitario ?? null,
        unidad_precio: data.unidad_precio,
        costo_por_kg: insumo?.costo_por_kg ?? null,
        ref_costo_unitario: insumo?.ref_costo_unitario ?? null,
        costo: insumo?.costo ?? null,
      });
      const ahora = new Date();

      // Creamos el lote limpio: sin operaciones de consumo iniciales
      const nuevoLote: StockMateriaPrima = {
        uid: `stk-${Math.random().toString(36).substr(2, 9)}`,
        insumo_id: data.id_insumo,
        id_insumo: data.id_insumo,
        id_proveedor: data.id_proveedor,
        lote: data.lote.toUpperCase(),
        cantidad_inicial: costo.cantidad_kg,
        cantidad_actual: costo.cantidad_kg,
        cantidad_comprometida: 0,
        costo_unitario: costo.costo_unitario,
        costo_total: costo.costo_total,
        fecha_ingreso: data.fecha_ingreso,
        remito_nro: data.remito_nro,
        ubicacion: data.ubicacion,
        operaciones: undefined, // Lote nuevo nace sin historial de consumo
        stock_transito: undefined,
        id_usuario: data.id_usuario,
        createdAt: ahora,
        updatedAt: ahora
      };

      // Aunque el lote no tenga "OperacionLote", registramos el hecho en el log global de auditoría
      const mov: Movimiento = {
        uid: `mov-ing-${Date.now()}`,
        fecha: ahora,
        id_usuario: data.id_usuario,
        tipo: TipoMovimiento.ENTRADA,
        origen: OrigenMovimiento.COMPRA,
        id_entidad: data.id_insumo,
        nombre_entidad: "Registro de Ingreso",
        cantidad: costo.cantidad_kg,
        lote_afectado: nuevoLote.lote,
      };

      nuevoLote.fecha_ingreso = parseLocalDateForBusinessDay(data.fecha_ingreso);
      stockDB = [nuevoLote, ...stockDB];
      movimientosDB.push(mov);
      
      setTimeout(() => resolve(nuevoLote), 600);
    });
  },

  async update(uid: string, data: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> {
    return new Promise((resolve, reject) => {
      const index = stockDB.findIndex(l => l.uid === uid);
      if (index === -1) return reject(new Error("Lote no encontrado"));

      const base = { ...stockDB[index], ...data };
      
      if (data.cantidad_inicial || data.costo_total) {
        const cant = data.cantidad_inicial || base.cantidad_inicial;
        const total = data.costo_total || base.costo_total;
        base.costo_unitario = total / cant;
      }

      base.updatedAt = new Date();
      stockDB[index] = base;

      setTimeout(() => resolve(base), 500);
    });
  },

  async delete(uid: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const lote = stockDB.find(l => l.uid === uid);
      if (!lote) return reject(new Error("El lote no existe."));

      if (lote.cantidad_actual !== lote.cantidad_inicial) {
        return reject(new Error("No se puede eliminar: el lote ya tiene consumos registrados."));
      }

      if ((lote.cantidad_comprometida || 0) > 0) {
        return reject(new Error("No se puede eliminar: el lote tiene stock comprometido."));
      }

      stockDB = stockDB.filter(l => l.uid !== uid);
      setTimeout(() => resolve(), 400);
    });
  }
};
