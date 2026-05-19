import type { StockMateriaPrima } from "../../../../features/insumos/types";
import { type Movimiento, TipoMovimiento, OrigenMovimiento } from "../../../../features/movimientos/types";
import { TipoUnidad } from "../../../../shared/types/global.interface";
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
const movimientosDB: Movimiento[] = [];

export const mockMateriaPrimaService = {
  
  async getAllLotes(): Promise<StockMateriaPrima[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...stockDB]), 500);
    });
  },

  async create(data: {
    id_insumo: string;
    id_proveedor: string;
    lote: string;
    remito_nro: string;
    cantidad: number;
    unidad_entrada: TipoUnidad;
    costo_total: number;
    id_usuario: string;
    fecha_ingreso: Date;
    ubicacion: string; 
  }): Promise<StockMateriaPrima> {
    
    return new Promise((resolve, reject) => {
      const loteExiste = stockDB.some(l => 
        l.lote.toUpperCase() === data.lote.toUpperCase()
      );
      if (loteExiste) return reject(new Error("El número de lote ya existe."));

      const factor = data.unidad_entrada === TipoUnidad.TON ? 1000 : 1;
      const cantidadEnKg = data.cantidad * factor;
      const costoUnitarioCalculado = data.costo_total / cantidadEnKg;
      const ahora = new Date();

      // Creamos el lote limpio: sin operaciones de consumo iniciales
      const nuevoLote: StockMateriaPrima = {
        uid: `stk-${Math.random().toString(36).substr(2, 9)}`,
        id_insumo: data.id_insumo,
        id_proveedor: data.id_proveedor,
        lote: data.lote.toUpperCase(),
        cantidad_inicial: cantidadEnKg,
        cantidad_actual: cantidadEnKg,
        cantidad_comprometida: 0,
        costo_unitario: costoUnitarioCalculado,
        costo_total: data.costo_total,
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
        cantidad: cantidadEnKg,
        lote_afectado: nuevoLote.lote,
      };

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
