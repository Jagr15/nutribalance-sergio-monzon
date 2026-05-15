import { ApiService } from '../../../infrastructure/api/';
import type { StockMateriaPrima } from "../types";

export const stockMateriaPrimaService = {
  findAll: async (): Promise<StockMateriaPrima[]> => {
    return await ApiService.stockMP.getAllLotes();
  },

  create: async (data: any): Promise<StockMateriaPrima> => {
    console.log("data",data)
    return await ApiService.stockMP.create(data);
  },

  update: async (uid: string, data: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> => {
    return await ApiService.stockMP.update(uid, data);
  },

  delete: async (uid: string): Promise<void> => {
    return await ApiService.stockMP.delete(uid);
  }
};