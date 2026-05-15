// src/features/ordenes/services/mockOrdenService.ts
import type { OrdenProduccion } from '../../../../features/ordenes/types';
import initialData from '../data/ordenes.json';

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
    return new Promise((resolve) => {
      const newOrder = { ...data, id: `OP-${Math.random().toString(36).substr(2, 5).toUpperCase()}` };
      ordersDb.push(newOrder);
      setTimeout(() => resolve(newOrder), 500);
    });
  },

  update: async (id: string, data: Partial<OrdenProduccion>): Promise<OrdenProduccion> => {
    return new Promise((resolve, reject) => {
      const index = ordersDb.findIndex(o => o.id === id);
      if (index === -1) return reject(new Error("Not found"));
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
    return mockOrdenService.update(id, { estado: 'EN PROCESO' as any });
  },

  finishProduction: async (id: string, payload: any) => {
    return mockOrdenService.update(id, { 
      ...payload, 
      merma_manual: payload.merma, 
      estado: 'FINALIZADA' as any 
    });
  }
};