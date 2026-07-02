import type { Insumo, StockMateriaPrima } from '../../../../features/insumos/types/insumo';
import insumosData from '../data/insumos.json';
import stockData from '../data/stockMateriaPrima.json';
import { mockApiCall } from '../mockClient';

// Persistencia temporal en memoria
let mockInsumos: Insumo[] = (insumosData as unknown) as Insumo[];
let mockStock: StockMateriaPrima[] = (stockData as unknown) as StockMateriaPrima[];

export const mockInsumoService = {
  // ==========================================
  // --- CRUD: DEFINICIÓN DE INSUMOS ---
  // ==========================================
  
  getAllInsumos: async (): Promise<Insumo[]> => {
    return mockApiCall(mockInsumos);
  },

  createInsumo: async (data: Omit<Insumo, 'uid'>): Promise<Insumo> => {
    const nuevo: Insumo = {
      ...data,
      ref_costo_unitario: data.costo_por_kg ?? data.ref_costo_unitario,
      costo: data.costo ?? data.costo_por_kg ?? data.ref_costo_unitario,
      costo_por_kg: data.costo_por_kg ?? data.ref_costo_unitario,
      costo_por_tonelada: data.costo_por_tonelada ?? ((data.costo_por_kg ?? data.ref_costo_unitario ?? 0) * 1000),
      proteina_bruta_pct: data.proteina_bruta_pct ?? null,
      unidad_costo: data.unidad_costo ?? 'KG',
      uid: `i-${Math.floor(Math.random() * 1000)}`
    };
    mockInsumos = [...mockInsumos, nuevo];
    return mockApiCall(nuevo);
  },

  // ESTO ES LO QUE FALTABA
  updateInsumo: async (uid: string, data: Partial<Insumo>): Promise<Insumo> => {
    let updatedInsumo: Insumo | undefined;
    
    mockInsumos = mockInsumos.map(item => {
      if (item.uid === uid) {
        updatedInsumo = { ...item, ...data };
        return updatedInsumo;
      }
      return item;
    });

    if (!updatedInsumo) throw new Error(`Insumo con UID ${uid} no encontrado`);
    return mockApiCall(updatedInsumo);
  },

  deleteInsumo: async (uid: string): Promise<void> => {
    mockInsumos = mockInsumos.filter(item => item.uid !== uid);
    return mockApiCall(undefined);
  },

  // ==========================================
  // --- CRUD: STOCK (LOTES/MATERIA PRIMA) ---
  // ==========================================

  findAllStock: async (): Promise<StockMateriaPrima[]> => {
    return mockApiCall(mockStock);
  },

  createStock: async (data: StockMateriaPrima): Promise<StockMateriaPrima> => {
    mockStock = [...mockStock, data];
    return mockApiCall(data);
  },

  updateStock: async (uid: string, data: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> => {
    let updatedStock: StockMateriaPrima | undefined;
    
    mockStock = mockStock.map(item => {
      if (item.uid === uid) {
        updatedStock = { ...item, ...data };
        return updatedStock;
      }
      return item;
    });

    if (!updatedStock) throw new Error(`Stock con UID ${uid} no encontrado`);
    return mockApiCall(updatedStock);
  },

  deleteStock: async (uid: string): Promise<void> => {
    mockStock = mockStock.filter(item => item.uid !== uid);
    return mockApiCall(undefined);
  }
};
