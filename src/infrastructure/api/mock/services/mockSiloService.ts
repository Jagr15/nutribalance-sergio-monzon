import type { Silo } from '../../../../features/silos/types';
import type { Insumo } from '../../../../features/insumos/types/insumo';
import initialData from '../data/silo.json';
import { getMockStockSnapshot } from './mockMateriaPrimaService';
import { getMockStockPTRows } from './mockStockPTService';
import { mockInsumoService } from './mockInsumoService';
import { mockOrdenService } from './mockOrdenService';

type StockMateriaPrimaRow = {
  cantidad_actual?: number;
  cantidad_comprometida?: number;
  ubicacion?: string;
  id_insumo?: string;
  insumo_id?: string;
};

type StockPTRow = {
  cantidad_total?: number;
  id_silo?: string | null;
  nombre_silo?: string | null;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const buildMockStockBySilo = async () => {
  const stockMateriaPrima = getMockStockSnapshot().stockDB as StockMateriaPrimaRow[];
  const stockPT = getMockStockPTRows() as StockPTRow[];
  const insumos = await mockInsumoService.getAllInsumos();

  const insumosMap = new Map<string, Insumo>();
  insumos.forEach((i) => insumosMap.set(i.uid, i));

  const mpByLocation = new Map<string, number>();
  stockMateriaPrima.forEach((row) => {
    const ubicacion = row.ubicacion?.trim();
    if (!ubicacion) return;

    // Las cantidades en stock ya se guardan normalizadas en kilogramos (KG),
    // por lo que no es necesario volver a multiplicarlas por 1000 si el insumo está en toneladas.
    const disponibleKg = Math.max(0, Number(row.cantidad_actual ?? 0) - Number(row.cantidad_comprometida ?? 0));

    mpByLocation.set(normalizeText(ubicacion), (mpByLocation.get(normalizeText(ubicacion)) ?? 0) + disponibleKg);
  });

  const ptBySilo = new Map<string, number>();
  stockPT.forEach((row) => {
    const keys = [row.id_silo, row.nombre_silo].filter((value): value is string => Boolean(value && value.trim()));
    const saldoKg = Math.max(0, Number(row.cantidad_total ?? 0));
    keys.forEach((key) => {
      ptBySilo.set(normalizeText(key), (ptBySilo.get(normalizeText(key)) ?? 0) + saldoKg);
    });
  });

  return { mpByLocation, ptBySilo };
};

const getMockSiloStockTon = (silo: Silo, mpByLocation: Map<string, number>, ptBySilo: Map<string, number>) => {
  const mpKg = silo.tipo_uso === 'MATERIA_PRIMA'
    ? mpByLocation.get(normalizeText(silo.nombre)) ?? 0
    : 0;
  const ptKg = silo.tipo_uso === 'PRODUCTO_TERMINADO'
    ? ptBySilo.get(normalizeText(silo.uid)) ?? ptBySilo.get(normalizeText(silo.nombre)) ?? 0
    : 0;
  return Number(((mpKg + ptKg) / 1000).toFixed(2));
};

// Simulamos una base de datos local para el mock
let silosDb: Silo[] = (initialData as Silo[]).map((silo) => ({
  ...silo,
  tipo_uso: silo.tipo_uso ?? 'MATERIA_PRIMA',
  esta_activo: silo.esta_activo ?? true,
  stock_actual_ton: 0,
}));

export const mockSiloService = {
  /**
   * Obtiene todos los silos registrados
   */
  getAll: async (): Promise<Silo[]> => {
    const { mpByLocation, ptBySilo } = await buildMockStockBySilo();
    const updated = silosDb
      .filter((s: any) => !s.deletedAt)
      .map(s => ({
        ...s,
        stock_actual_ton: getMockSiloStockTon(s, mpByLocation, ptBySilo)
      }));
    return new Promise((resolve) => {
      setTimeout(() => resolve(updated), 500);
    });
  },

  /**
   * Obtiene un silo por su UID
   */
  getById: async (uid: string): Promise<Silo | undefined> => {
    const { mpByLocation, ptBySilo } = await buildMockStockBySilo();
    return new Promise((resolve) => {
      const silo = silosDb.find(s => s.uid === uid && !(s as any).deletedAt);
      if (!silo) return setTimeout(() => resolve(undefined), 300);
      const updated = {
        ...silo,
        stock_actual_ton: getMockSiloStockTon(silo, mpByLocation, ptBySilo)
      };
      setTimeout(() => resolve(updated), 300);
    });
  },

  /**
   * Crea un nuevo registro de silo
   */
  create: async (data: Omit<Silo, 'uid'>): Promise<Silo> => {
    return new Promise((resolve) => {
      const nuevoSilo: Silo = {
        ...data,
        tipo_uso: data.tipo_uso ?? 'MATERIA_PRIMA',
        uid: `silo-${Math.random().toString(36).substr(2, 9)}`, // Generación de UID temporal
        stock_actual_ton: 0,
      };
      silosDb.push(nuevoSilo);
      setTimeout(() => resolve(nuevoSilo), 600);
    });
  },

  /**
   * Actualiza los datos de un silo existente
   */
  update: async (uid: string, data: Partial<Silo>): Promise<Silo> => {
    const { mpByLocation, ptBySilo } = await buildMockStockBySilo();
    return new Promise((resolve, reject) => {
      const index = silosDb.findIndex(s => s.uid === uid);
      if (index === -1) return reject(new Error("Silo no encontrado"));

      const actualizado = { ...silosDb[index], ...data };
      silosDb[index] = actualizado;
      
      const updated = {
        ...actualizado,
        stock_actual_ton: getMockSiloStockTon(actualizado, mpByLocation, ptBySilo)
      };
      setTimeout(() => resolve(updated), 600);
    });
  },

  /**
   * Elimina un silo del sistema
   */
  delete: async (uid: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const silo = silosDb.find(s => s.uid === uid);
      if (!silo) {
        setTimeout(() => resolve(true), 100);
        return;
      }

      const stockMateriaPrima = getMockStockSnapshot().stockDB as StockMateriaPrimaRow[];
      const hasStock = stockMateriaPrima.some(
        l => l.ubicacion?.trim().toLowerCase() === silo.nombre.trim().toLowerCase() && !(l as any).deletedAt
      );

      const stockPT = getMockStockPTRows() as StockPTRow[];
      const hasPT = stockPT.some(
        row => (row.id_silo === uid || row.nombre_silo?.trim().toLowerCase() === silo.nombre.trim().toLowerCase())
      );

      mockOrdenService.getAll().then((orders) => {
        const hasOrders = orders.some(o => o.id_silo === uid || o.destino_silo?.trim().toLowerCase() === silo.nombre.trim().toLowerCase());
        if (hasStock || hasPT || hasOrders) {
          reject(new Error('No se puede eliminar el silo porque está asociado a lotes de stock u órdenes de producción.'));
          return;
        }

        silosDb = silosDb.map((s) => (s.uid === uid ? { ...s, esta_activo: false, deletedAt: new Date().toISOString() } : s));
        setTimeout(() => resolve(true), 500);
      }).catch((e) => {
        reject(e);
      });
    });
  },

  toggleActive: async (uid: string, activo: boolean): Promise<Silo> => {
    const { mpByLocation, ptBySilo } = await buildMockStockBySilo();
    return new Promise((resolve, reject) => {
      const index = silosDb.findIndex((s) => s.uid === uid);
      if (index === -1) return reject(new Error('Silo no encontrado'));
      const actualizado = { ...silosDb[index], esta_activo: activo };
      silosDb[index] = actualizado;

      const updated = {
        ...actualizado,
        stock_actual_ton: getMockSiloStockTon(actualizado, mpByLocation, ptBySilo)
      };
      setTimeout(() => resolve(updated), 300);
    });
  }
};

export const getMockSilosLocal = () => silosDb;
