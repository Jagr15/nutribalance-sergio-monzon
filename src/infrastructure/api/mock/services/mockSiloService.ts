import type{ Silo } from '../../../../features/silos/types';
import initialData from '../data/silo.json';

// Simulamos una base de datos local para el mock
let silosDb: Silo[] = (initialData as Silo[]).map((silo) => ({
  ...silo,
  tipo_uso: silo.tipo_uso ?? 'MATERIA_PRIMA',
}));

export const mockSiloService = {
  /**
   * Obtiene todos los silos registrados
   */
  getAll: async (): Promise<Silo[]> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...silosDb]), 500);
    });
  },

  /**
   * Obtiene un silo por su UID
   */
  getById: async (uid: string): Promise<Silo | undefined> => {
    return new Promise((resolve) => {
      const silo = silosDb.find(s => s.uid === uid);
      setTimeout(() => resolve(silo), 300);
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
        uid: `silo-${Math.random().toString(36).substr(2, 9)}` // Generación de UID temporal
      };
      silosDb.push(nuevoSilo);
      setTimeout(() => resolve(nuevoSilo), 600);
    });
  },

  /**
   * Actualiza los datos de un silo existente
   */
  update: async (uid: string, data: Partial<Silo>): Promise<Silo> => {
    return new Promise((resolve, reject) => {
      const index = silosDb.findIndex(s => s.uid === uid);
      if (index === -1) return reject(new Error("Silo no encontrado"));

      const actualizado = { ...silosDb[index], ...data };
      silosDb[index] = actualizado;
      
      setTimeout(() => resolve(actualizado), 600);
    });
  },

  /**
   * Elimina un silo del sistema
   */
  delete: async (uid: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const initialLength = silosDb.length;
      silosDb = silosDb.filter(s => s.uid !== uid);
      setTimeout(() => resolve(silosDb.length < initialLength), 500);
    });
  }
};
