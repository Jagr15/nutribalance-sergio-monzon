import { ApiService } from '../../../infrastructure/api/';
import type { Silo } from '../types/silo';

export const siloService = {
  // ==========================================
  // --- Gestión de Silos / Almacenamiento ---
  // ==========================================

  getAll: (): Promise<Silo[]> => {
    return ApiService.silos.getAll();
  },

  /**
   * Busca un silo específico por su identificador único.
   * Útil para cargar datos en formularios de edición.
   */
  getById: async (uid: string): Promise<Silo | undefined> => {
    const all = await ApiService.silos.getAll();
    return all.find(s => s.uid === uid);
  },

  /**
   * Registra un nuevo silo en el sistema.
   * @param data Objeto silo sin el UID (generado por el backend).
   */
  create: (data: Omit<Silo, 'uid'>): Promise<Silo> => {
    return ApiService.silos.create(data);
  },

  /**
   * Actualiza la información de un silo existente.
   * @param uid Identificador único del silo.
   * @param data Campos parciales a actualizar (nombre o descripción).
   */
  update: (uid: string, data: Partial<Silo>): Promise<Silo> => {
    return ApiService.silos.update(uid, data);
  },

  /**
   * Elimina un silo del catálogo.
   * @param uid Identificador único del silo.
   */
  delete: (uid: string): Promise<void> => {
    return ApiService.silos.delete(uid);
  }
};