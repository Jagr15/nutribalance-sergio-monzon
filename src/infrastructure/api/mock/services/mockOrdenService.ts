// src/features/ordenes/services/mockOrdenService.ts
import type { OrdenProduccion } from '../../../../features/ordenes/types';
import { EstadoOrden } from '../../../../features/ordenes/types';
import initialData from '../data/ordenes.json';

interface FinishProductionPayload {
  merma: number;
  cantidad_real: number;
  destino_silo: string;
  lote_salida: string;
}

let ordersDb: OrdenProduccion[] = [...initialData] as OrdenProduccion[];

export const mockOrdenService = {
  // --- OPERACIONES CRUD BÁSICAS ---
  
  getAll: async (): Promise<OrdenProduccion[]> => {
    return new Promise((resolve) => setTimeout(() => resolve([...ordersDb]), 500));
  },

  getById: async (id: string): Promise<OrdenProduccion | undefined> => {
    return new Promise((resolve) => {
      const order = ordersDb.find(o => o.id === id);
      setTimeout(() => resolve(order), 300);
    });
  },

  create: async (data: Omit<OrdenProduccion, 'id'>): Promise<OrdenProduccion> => {
    return new Promise((resolve, reject) => {
      const lote = (data.lote ?? '').trim().toUpperCase();
      if (!lote) return reject(new Error('El lote es obligatorio.'));
      if (ordersDb.some((o) => (o.lote ?? '').trim().toUpperCase() === lote)) {
        return reject(new Error('Ya existe una orden con ese lote.'));
      }
      const objetivo = Number(data.cantidad_objetivo);
      if (!Number.isFinite(objetivo) || objetivo <= 0) {
        return reject(new Error('La cantidad objetivo debe ser mayor a 0.'));
      }
      const newOrder = { ...data, lote, id: `OP-${Math.random().toString(36).substr(2, 5).toUpperCase()}` };
      ordersDb.push(newOrder);
      setTimeout(() => resolve(newOrder), 500);
    });
  },

  update: async (id: string, data: Partial<OrdenProduccion>): Promise<OrdenProduccion> => {
    return new Promise((resolve, reject) => {
      const index = ordersDb.findIndex(o => o.id === id);
      if (index === -1) return reject(new Error("Not found"));
      const current = ordersDb[index];
      if (data.estado === EstadoOrden.EN_PROCESO && current.estado !== EstadoOrden.PENDIENTE) {
        return reject(new Error('Solo se puede iniciar una orden PENDIENTE.'));
      }
      if (data.estado === EstadoOrden.FINALIZADO && current.estado !== EstadoOrden.EN_PROCESO) {
        return reject(new Error('Solo se puede finalizar una orden EN PROCESO.'));
      }
      ordersDb[index] = { ...ordersDb[index], ...data };
      setTimeout(() => resolve(ordersDb[index]), 500);
    });
  },

  delete: async (id: string): Promise<boolean> => {
    return new Promise((resolve) => {
      ordersDb = ordersDb.filter(o => o.id !== id);
      setTimeout(() => resolve(true), 400);
    });
  },

  // --- MÉTODOS DE PROCESO (WORKFLOW) ---
  // Estos métodos por debajo llaman al 'update', pero con nombres claros para la UI

  startProduction: async (id: string) => {
    return mockOrdenService.update(id, { estado: EstadoOrden.EN_PROCESO });
  },

  finishProduction: async (id: string, payload: FinishProductionPayload) => {
    if (!Number.isFinite(payload.cantidad_real) || payload.cantidad_real <= 0) {
      throw new Error('La cantidad real debe ser mayor a 0.');
    }
    if (!payload.lote_salida?.trim()) {
      throw new Error('El lote de salida es obligatorio.');
    }
    return mockOrdenService.update(id, { 
      ...payload,
      merma_manual: payload.merma, 
      estado: EstadoOrden.FINALIZADO 
    });
  }
};
