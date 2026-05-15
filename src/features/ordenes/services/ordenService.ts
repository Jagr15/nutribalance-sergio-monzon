// src/features/ordenes/services/useOrdenService.ts
import { ApiService } from '../../../infrastructure/api/';
import type { OrdenProduccion } from '../types/orden';

export const useOrdenService = {
  // ==========================================
  // --- Gestión de Órdenes de Producción ---
  // ==========================================

  /**
   * Obtiene el listado completo de órdenes
   */
  getAll: (): Promise<OrdenProduccion[]> => {
    return ApiService.ordenes.getAll();
  },

  /**
   * Obtiene una orden específica por su ID
   */
  getById: async (id: string): Promise<OrdenProduccion | undefined> => {
    const all = await ApiService.ordenes.getAll();
    return all.find(o => o.id === id);
  },

  /**
   * Crea una nueva orden de producción (Estado inicial: PENDIENTE)
   */
  create: (data: Omit<OrdenProduccion, 'id'>): Promise<OrdenProduccion> => {
    return ApiService.ordenes.create(data);
  },

  /**
   * Actualización genérica de campos de la orden
   */
  update: (id: string, data: Partial<OrdenProduccion>): Promise<OrdenProduccion> => {
    return ApiService.ordenes.update(id, data);
  },

  /**
   * Elimina una orden (Normalmente solo permitido si está PENDIENTE)
   */
  delete: (id: string): Promise<void> => {
    return ApiService.ordenes.delete(id);
  },

  // ==========================================
  // --- Acciones de Proceso (Workflow) ---
  // ==========================================

  /**
   * Cambia el estado de la orden a 'EN PROCESO'
   */
  startProduction: (id: string): Promise<OrdenProduccion> => {
    return ApiService.ordenes.update(id, { 
      estado: 'EN PROCESO' as any,
      // Aquí podrías enviar un timestamp de inicio si el backend lo requiere
    });
  },

  /**
   * Finaliza la orden registrando mermas, cantidades reales y silo de destino
   */
  finishProduction: (
    id: string, 
    payload: { 
      lote_salida: string; 
      merma: number; 
      cantidad_real: number; 
      destino_silo: string; 
    }
  ): Promise<OrdenProduccion> => {
    return ApiService.ordenes.update(id, {
      ...payload,
      merma_manual: payload.merma, // Mapeo para el backend si el campo difiere
      estado: 'FINALIZADA' as any,
    });
  }
};