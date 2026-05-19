import { ApiService } from '../../../infrastructure/api/';
import type { StockMateriaPrima } from "../types";

export interface NewStockEntryData {
  id_insumo: string;
  nombre_insumo: string;
  id_proveedor: string;
  nombre_prov: string;
  ubicacion: string;
  lote: string;
  remito_nro: string;
  cantidad: number;
  unidad_entrada: 'KG' | 'TON';
  costo_total: number;
  costo_unitario: number;
  fecha_ingreso: string;
  cantidad_actual: number;
  cantidad_inicial: number;
}

export const stockMateriaPrimaService = {
  findAll: async (): Promise<StockMateriaPrima[]> => {
    return await ApiService.stockMP.getAllLotes();
  },

  create: async (data: NewStockEntryData): Promise<StockMateriaPrima> => {
    return await ApiService.stockMP.create({
      id_insumo: data.id_insumo,
      id_proveedor: data.id_proveedor,
      lote: data.lote,
      remito_nro: data.remito_nro,
      cantidad: data.cantidad,
      unidad_entrada: data.unidad_entrada,
      costo_total: data.costo_total,
      id_usuario: 'usr-101',
      fecha_ingreso: new Date(data.fecha_ingreso),
      ubicacion: data.ubicacion,
    });
  },

  update: async (uid: string, data: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> => {
    return await ApiService.stockMP.update(uid, data);
  },

  delete: async (uid: string): Promise<void> => {
    return await ApiService.stockMP.delete(uid);
  }
};
