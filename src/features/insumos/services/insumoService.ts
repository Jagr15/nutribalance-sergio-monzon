//import { mockInsumoService } from '../../../infrastructure/api/mock/services/mockInsumoService'; // Cambiamos a la fuente real de datos
import { ApiService } from '../../../infrastructure/api/';
import type { Insumo, StockMateriaPrima } from '../types/insumo';

export const insumoService = {
  // ==========================================
  // --- Gestión de la Definición de Insumos ---
  // ==========================================

  getAll: (): Promise<Insumo[]> => {
    return ApiService.insumos.getAllInsumos();
  },

  // Agregamos este método que es útil para modales de edición
  getById: async (uid: string): Promise<Insumo | undefined> => {
    const all = await ApiService.insumos.getAllInsumos();
    return all.find((i: Insumo) => i.uid === uid);
  },

  create: (data: Omit<Insumo, 'uid'>): Promise<Insumo> => {
    return ApiService.insumos.createInsumo(data);
  },

  update: (uid: string, data: Partial<Insumo>): Promise<Insumo> => {
    return ApiService.insumos.updateInsumo(uid, data);
  },

  delete: (uid: string): Promise<void> => {
    return ApiService.insumos.deleteInsumo(uid);
  },

  // ==========================================
  // --- Gestión del Stock Físico (Movimientos) ---
  // ==========================================

  findAllStock: (): Promise<StockMateriaPrima[]> => {
    return ApiService.insumos.findAllStock();
  },

  createStockEntry: (data: StockMateriaPrima): Promise<StockMateriaPrima> => {
    return ApiService.insumos.createStock(data);
  },

  updateStock: (uid: string, data: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> => {
    return ApiService.insumos.updateStock(uid, data);
  },

  deleteStock: (uid: string): Promise<void> => {
    return ApiService.insumos.deleteStock(uid);
  }
};
