import type { Insumo, StockMateriaPrima } from '../../../../features/insumos/types/insumo';
import insumosData from '../data/insumos.json';
import stockData from '../data/stockMateriaPrima.json';
import { mockApiCall } from '../mockClient';
import { mockFormulaService } from './mockFormulaService';
import { mockOrdenService } from './mockOrdenService';
import { contabilidadOperativaService } from '../../../../features/finanzas/services/contabilidadOperativaService';

// Persistencia temporal en memoria
let mockInsumos: Insumo[] = (insumosData as unknown) as Insumo[];
let mockStock: StockMateriaPrima[] = (stockData as unknown) as StockMateriaPrima[];

export const getMockInsumosLocal = () => mockInsumos;

const getMetadataString = (meta: unknown, key: string): string | undefined => {
  if (!meta || typeof meta !== 'object') return undefined;
  const val = (meta as Record<string, unknown>)[key];
  return typeof val === 'string' ? val : undefined;
};

export const mockInsumoService = {
  // ==========================================
  // --- CRUD: DEFINICIÓN DE INSUMOS ---
  // ==========================================
  
  getAllInsumos: async (): Promise<Insumo[]> => {
    return mockApiCall(mockInsumos.filter((i: any) => !i.deletedAt));
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
      uid: `i-${Math.floor(Math.random() * 1000)}`,
      esta_activo: true
    } as any;
    mockInsumos = [...mockInsumos, nuevo];
    return mockApiCall(nuevo);
  },

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
    const hasStock = mockStock.some(l => l.id_insumo === uid && !(l as any).deletedAt);

    const formulas = await mockFormulaService.findAll();
    const hasFormula = formulas.some(f => f.ingredientes.some(ing => ing.id_insumo === uid));

    const orders = await mockOrdenService.getAll();
    const hasOrder = orders.some(o => o.detalle_insumos?.some((ing: any) => ing.id_insumo === uid || ing.insumo_id === uid));

    if (hasStock || hasFormula || hasOrder) {
      throw new Error('No se puede eliminar el insumo porque está siendo utilizado en recetas, lotes de stock u órdenes de producción.');
    }

    mockInsumos = mockInsumos.map(item =>
      item.uid === uid ? { ...item, esta_activo: false, deletedAt: new Date().toISOString() } : item
    );
    return mockApiCall(undefined);
  },

  // ==========================================
  // --- CRUD: STOCK (LOTES/MATERIA PRIMA) ---
  // ==========================================

  findAllStock: async (): Promise<StockMateriaPrima[]> => {
    return mockApiCall(mockStock.filter((s: any) => !s.deletedAt));
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
    const lot = mockStock.find(item => item.uid === uid);
    if (!lot) return mockApiCall(undefined);

    const isModified = lot.cantidad_actual !== lot.cantidad_inicial || (lot.cantidad_comprometida ?? 0) > 0;
    
    const orders = await mockOrdenService.getAll();
    const isLotUsed = orders.some(o => o.detalle_insumos?.some((d: any) => d.id_lote === uid || d.lote_id === uid));

    const movements = contabilidadOperativaService.getMovimientosMock();
    const isLinkedToConfirmedFin = movements.some(
      m => getMetadataString(m.metadata, 'stock_lote_legacy_uid') === uid && m.estado === 'CONFIRMADO'
    );

    if (isModified || isLotUsed || isLinkedToConfirmedFin) {
      throw new Error('No se puede eliminar el lote porque tiene consumos de stock o transacciones financieras confirmadas asociadas.');
    }

    // Soft delete corresponding pending cashflow movements in localStorage
    if (typeof window !== 'undefined') {
      const STORAGE_KEY = 'nutribalance_contabilidad_operativa_v1';
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((m: any) => {
              const matchesLote = (m.metadata?.stock_lote_legacy_uid === uid || m.metadata?.stock_lote_mp_id === uid);
              if (matchesLote && m.estado === 'PENDIENTE') {
                return { ...m, deletedAt: new Date().toISOString(), deleted_at: new Date().toISOString() };
              }
              return m;
            });
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          }
        }
      } catch (err) {
        console.error('Error soft-deleting pending mock financial movements:', err);
      }
    }

    mockStock = mockStock.map(item =>
      item.uid === uid ? { ...item, deletedAt: new Date().toISOString() } : item
    );
    return mockApiCall(undefined);
  }
};
