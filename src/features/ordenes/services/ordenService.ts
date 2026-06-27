// src/features/ordenes/services/useOrdenService.ts
import { ApiService } from '../../../infrastructure/api/';
import { EstadoOrden, type OrdenProduccion } from '../types/orden';
import { assertPermission } from '../../auth/accessControl';
import { auditAction } from '../../auth/audit';
import type { Silo } from '../../silos/types';

export interface FinalizarOrdenPayload {
  lote_salida: string;
  merma: number;
  cantidad_real: number;
  destino_silo: string;
}

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
    return all.find((o: OrdenProduccion) => o.id === id);
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
  delete: (id: string): Promise<boolean> => {
    assertPermission('ordenes', 'cancel_order');
    return ApiService.ordenes.delete(id).then(async (ok) => {
      if (ok) {
        await auditAction({
          modulo: 'ordenes',
          accion: 'cancel_order',
          entidad: 'orden_produccion',
          entidad_ref: id,
        });
      }
      return ok;
    });
  },

  // ==========================================
  // --- Acciones de Proceso (Workflow) ---
  // ==========================================

  /**
   * Cambia el estado de la orden a 'EN PROCESO'
   */
  startProduction: (id: string): Promise<OrdenProduccion> => {
    assertPermission('ordenes', 'start_order');
    return ApiService.ordenes.update(id, { 
      estado: EstadoOrden.EN_PROCESO,
      // Aquí podrías enviar un timestamp de inicio si el backend lo requiere
    }).then(async (result) => {
      await auditAction({
        modulo: 'ordenes',
        accion: 'start_order',
        entidad: 'orden_produccion',
        entidad_ref: id,
      });
      return result;
    });
  },

  /**
   * Finaliza la orden registrando mermas, cantidades reales y silo de destino
   */
  finishProduction: (
    id: string, 
    payload: FinalizarOrdenPayload
  ): Promise<OrdenProduccion> => {
    assertPermission('ordenes', 'finish_order');
    if (!payload.lote_salida?.trim()) {
      throw new Error('El lote de salida es obligatorio.');
    }
    if (!payload.destino_silo?.trim()) {
      throw new Error('El silo de destino es obligatorio.');
    }
    if (Number.isNaN(payload.cantidad_real) || payload.cantidad_real <= 0) {
      throw new Error('La cantidad real debe ser mayor a 0.');
    }
    if (Number.isNaN(payload.merma) || payload.merma < 0) {
      throw new Error('La merma debe ser mayor o igual a 0.');
    }

    const normalizedPayload: FinalizarOrdenPayload = {
      ...payload,
      lote_salida: payload.lote_salida.trim().toUpperCase(),
      destino_silo: payload.destino_silo.trim(),
    };

    const silosService = (ApiService as typeof ApiService & { silos?: { getAll: () => Promise<Silo[]> } }).silos;
    const validateDestinationSilo = silosService?.getAll
      ? silosService.getAll().then((silos) => {
          const siloSeleccionado = silos.find((silo) => silo.uid === normalizedPayload.destino_silo || silo.nombre === normalizedPayload.destino_silo);
          if (!siloSeleccionado) {
            throw new Error('El silo de destino seleccionado no existe.');
          }
          if (siloSeleccionado.tipo_uso !== 'PRODUCTO_TERMINADO') {
            throw new Error('Solo se puede finalizar la orden en silos de Producto Terminado.');
          }
          normalizedPayload.destino_silo = siloSeleccionado.nombre;
        })
      : Promise.resolve();

    return validateDestinationSilo.then(() => ApiService.ordenes.update(id, {
      ...normalizedPayload,
      merma_manual: payload.merma, // Mapeo para el backend si el campo difiere
      estado: EstadoOrden.FINALIZADO,
      }).then(async (result) => {
        await auditAction({
          modulo: 'ordenes',
          accion: 'finish_order',
          entidad: 'orden_produccion',
          entidad_ref: id,
          payload: {
            cantidad_real: payload.cantidad_real,
            merma: payload.merma,
            destino_silo: payload.destino_silo,
          },
        });
        return result;
      }));
  }
};
