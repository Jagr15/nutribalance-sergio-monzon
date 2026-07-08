// src/features/ordenes/services/mockOrdenService.ts
import type { OrdenProduccion } from '../../../../features/ordenes/types';
import { EstadoOrden } from '../../../../features/ordenes/types';
import { planFifoConsumption, type StockLoteForFlow } from '../../../../features/ordenes/utils/productionFlow';
import initialData from '../data/ordenes.json';
import { mockFormulaService } from './mockFormulaService';
import {
  consumeStockForDetalle,
  getMockStockSnapshot,
  releaseStockForDetalle,
  reserveStockForDetalle,
  restoreMockStockSnapshot,
} from './mockMateriaPrimaService';
import { registerMockIngresoPT, registerMockStockPTAdjustCallback, mockStockPTService } from './mockStockPTService';
import { mockMateriaPrimaService } from './mockMateriaPrimaService';
import { getTodayDateInputValue } from '../../../../shared/utils/formatters';

interface FinishProductionPayload {
  merma: number;
  cantidad_real: number;
  destino_silo: string;
  lote_salida: string;
}

let ordersDb: OrdenProduccion[] = [...initialData] as OrdenProduccion[];

const extractSequentialNumber = (value: string) => {
  const match = value.match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : NaN;
};

const nextOrdenNumber = (() => {
  const initialMax = ordersDb.reduce((max, order) => {
    const candidates = [order.lote, order.id].filter(Boolean) as string[];
    const candidateMax = candidates.reduce((innerMax, candidate) => {
      const seq = extractSequentialNumber(candidate);
      return Number.isFinite(seq) ? Math.max(innerMax, seq) : innerMax;
    }, 0);
    return Math.max(max, candidateMax);
  }, 0);

  let current = initialMax;
  return () => {
    current += 1;
    return `OP-${String(current).padStart(6, '0')}`;
  };
})();

const buildStockLotesForFlow = async (): Promise<StockLoteForFlow[]> => {
  const [stockLotes, formulas] = await Promise.all([
    mockMateriaPrimaService.getAllLotes(),
    mockFormulaService.findAll(),
  ]);

  const insumoNombreById = new Map(
    formulas.flatMap((formula) => formula.ingredientes.map((ingrediente) => [ingrediente.id_insumo, ingrediente.nombre_insumo] as const))
  );

  return stockLotes.map((lote) => ({
    id: lote.uid,
    legacy_uid: lote.uid,
    lote: lote.lote,
    insumo_id: lote.id_insumo,
    insumo_legacy_uid: lote.id_insumo,
    insumo_nombre: insumoNombreById.get(lote.id_insumo) ?? lote.id_insumo,
    fecha_ingreso: new Date(lote.fecha_ingreso).toISOString(),
    cantidad_actual: lote.cantidad_actual,
    cantidad_comprometida: lote.cantidad_comprometida ?? 0,
    costo_unitario: lote.costo_unitario,
  }));
};

const getDetalleParaReserva = async (data: Omit<OrdenProduccion, 'id'>, preferExistingDetalle = true) => {
  if (preferExistingDetalle && data.detalle_insumos.length > 0) {
    return data.detalle_insumos;
  }

  const formula = await mockFormulaService.getById(data.id_formula);
  if (!formula) {
    throw new Error('La fórmula seleccionada no existe.');
  }

  const lotes = await buildStockLotesForFlow();
  const fifoPlan = planFifoConsumption(data.cantidad_objetivo, formula.ingredientes, lotes);

  if (!fifoPlan.stockSuficiente) {
    throw new Error(`Stock insuficiente para: ${fifoPlan.faltantes.join(', ')}`);
  }

  return fifoPlan.detalle;
};

export const mockOrdenService = {
  // --- OPERACIONES CRUD BÁSICAS ---
  
  getAll: async (): Promise<OrdenProduccion[]> => {
    const stockPT = await mockStockPTService.getAll();
    const stockMap = new Map<string, number>();
    stockPT.forEach((st) => {
      if (st.id_orden) {
        stockMap.set(st.id_orden, st.cantidad_total);
      }
    });

    const activeOrders = ordersDb.filter((o: any) => !o.deletedAt);
    const enrichedOrders = activeOrders.map((order) => ({
      ...order,
      stock_disponible: stockMap.get(order.id) ?? stockMap.get(order.lote) ?? null,
    }));

    return new Promise((resolve) => setTimeout(() => resolve(enrichedOrders), 500));
  },

  getById: async (id: string): Promise<OrdenProduccion | undefined> => {
    const stockPT = await mockStockPTService.getAll();
    const stockMap = new Map<string, number>();
    stockPT.forEach((st) => {
      if (st.id_orden) {
        stockMap.set(st.id_orden, st.cantidad_total);
      }
    });

    return new Promise((resolve) => {
      const order = ordersDb.find(o => o.id === id && !(o as any).deletedAt);
      if (order) {
        const enriched = {
          ...order,
          stock_disponible: stockMap.get(order.id) ?? stockMap.get(order.lote) ?? null,
        };
        setTimeout(() => resolve(enriched), 300);
      } else {
        setTimeout(() => resolve(undefined), 300);
      }
    });
  },

  create: async (data: Omit<OrdenProduccion, 'id'>): Promise<OrdenProduccion> => {
    return new Promise((resolve, reject) => {
      const objetivo = Number(data.cantidad_objetivo);
      if (!Number.isFinite(objetivo) || objetivo <= 0) {
        return reject(new Error('La cantidad objetivo debe ser mayor a 0.'));
      }

      const lote = nextOrdenNumber();

      getDetalleParaReserva({ ...data, lote }).then((detalle) => {
        const newOrder: OrdenProduccion = {
          ...data,
          fecha_programada: data.fecha_programada ?? getTodayDateInputValue(),
          lote,
          detalle_insumos: detalle,
          id: lote,
        };

        try {
          ordersDb.push(newOrder);
          reserveStockForDetalle(detalle, newOrder.id);
        } catch (error) {
          ordersDb = ordersDb.filter((order) => order.id !== newOrder.id);
          return reject(error instanceof Error ? error : new Error('No se pudo reservar stock.'));
        }

        setTimeout(() => resolve(newOrder), 500);
      }).catch((error: unknown) => {
        reject(error instanceof Error ? error : new Error('No se pudo crear la orden.'));
      });
    });
  },

  update: async (id: string, data: Partial<OrdenProduccion>): Promise<OrdenProduccion> => {
    return new Promise((resolve, reject) => {
      const index = ordersDb.findIndex(o => o.id === id);
      if (index === -1) return reject(new Error("Not found"));
      const current = ordersDb[index];
      if (current.estado === EstadoOrden.FINALIZADO) {
        return reject(new Error('No se puede editar una orden finalizada.'));
      }
      if (current.estado === EstadoOrden.ANULADO) {
        return reject(new Error('No se puede editar una orden anulada.'));
      }
      if (data.estado === EstadoOrden.EN_PROCESO && current.estado !== EstadoOrden.PENDIENTE) {
        return reject(new Error('Solo se puede iniciar una orden PENDIENTE.'));
      }
      if (data.estado === EstadoOrden.FINALIZADO && current.estado !== EstadoOrden.EN_PROCESO) {
        return reject(new Error('Solo se puede finalizar una orden EN PROCESO.'));
      }

      const requiresReservationRebuild =
        typeof data.id_formula !== 'undefined' ||
        typeof data.cantidad_objetivo !== 'undefined' ||
        typeof data.detalle_insumos !== 'undefined';

      if (requiresReservationRebuild) {
        if (data.detalle_insumos !== undefined && data.detalle_insumos.length === 0) {
          return reject(new Error('La orden no tiene consumo planificado.'));
        }

        const stockSnapshot = getMockStockSnapshot();
        const ordersSnapshot = structuredClone(ordersDb);

        try {
          releaseStockForDetalle(current.detalle_insumos, current.id);
        } catch (error) {
          ordersDb = ordersSnapshot;
          restoreMockStockSnapshot(stockSnapshot);
          return reject(error instanceof Error ? error : new Error('No se pudo actualizar la orden.'));
        }

        const merged: OrdenProduccion = {
          ...current,
          ...data,
        };

        const detallePromise = data.detalle_insumos && data.detalle_insumos.length > 0
          ? Promise.resolve(data.detalle_insumos)
          : getDetalleParaReserva(merged, false);

        detallePromise
          .then((detalleRecalculado) => {
            try {
              reserveStockForDetalle(detalleRecalculado, current.id);
              ordersDb[index] = {
                ...merged,
                detalle_insumos: detalleRecalculado,
              };
              setTimeout(() => resolve(ordersDb[index]), 500);
            } catch (error) {
              ordersDb = ordersSnapshot;
              restoreMockStockSnapshot(stockSnapshot);
              reject(error instanceof Error ? error : new Error('No se pudo actualizar la orden.'));
            }
          })
          .catch((error: unknown) => {
            ordersDb = ordersSnapshot;
            restoreMockStockSnapshot(stockSnapshot);
            reject(error instanceof Error ? error : new Error('No se pudo actualizar la orden.'));
          });
        return;
      }

      if (data.estado === EstadoOrden.FINALIZADO) {
        try {
          const factor = current.cantidad_objetivo > 0 ? Number(((data.cantidad_real ?? current.cantidad_real ?? current.cantidad_objetivo) / current.cantidad_objetivo).toFixed(6)) : 1;
          consumeStockForDetalle(current.detalle_insumos, current.id, factor);

          const loteSalida = typeof (data as { lote_salida?: string }).lote_salida === 'string'
            ? (data as { lote_salida?: string }).lote_salida
            : current.lote;
          const cantidadReal = Number(data.cantidad_real ?? current.cantidad_real ?? current.cantidad_objetivo);
          const destinoSilo = typeof (data as { destino_silo?: string }).destino_silo === 'string'
            ? (data as { destino_silo?: string }).destino_silo
            : current.destino_silo;

          registerMockIngresoPT({
            id_orden: current.id,
            numero_orden: current.lote,
            id_formula: current.id_formula,
            version_formula: current.version_formula,
            nombre_producto: current.nombre_producto,
            cantidad_total: cantidadReal,
            lote: loteSalida ?? current.lote,
            unidad_medida: 'KG',
            id_silo: current.id_silo ?? null,
            nombre_silo: destinoSilo ?? '',
            detalle_insumos: current.detalle_insumos,
            usuario: current.usuario_responsable,
            costo_unitario_estimado: current.cantidad_objetivo > 0
              ? Number((current.costo_total_insumos / current.cantidad_objetivo).toFixed(6))
              : null,
          });
        } catch (error) {
          return reject(error instanceof Error ? error : new Error('No se pudo consumir el stock reservado.'));
        }
      }
      ordersDb[index] = { ...ordersDb[index], ...data };
      setTimeout(() => resolve(ordersDb[index]), 500);
    });
  },

  delete: async (id: string): Promise<boolean> => {
    const stockPT = await mockStockPTService.getAll();
    const hasPT = stockPT.some((st) => st.id_orden === id);
    if (hasPT) {
      throw new Error('No se puede eliminar la orden porque tiene producción registrada en stock de producto terminado.');
    }

    return new Promise((resolve, reject) => {
      const current = ordersDb.find((o) => o.id === id);
      if (!current) {
        setTimeout(() => resolve(true), 400);
        return;
      }
      if (current.estado === EstadoOrden.FINALIZADO) {
        reject(new Error('No se puede eliminar una orden finalizada.'));
        return;
      }

      try {
        releaseStockForDetalle(current.detalle_insumos, current.id);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('No se pudo liberar la reserva de stock.'));
        return;
      }

      ordersDb = ordersDb.map(o => o.id === id ? { ...o, deletedAt: new Date().toISOString() } : o);
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

registerMockStockPTAdjustCallback((idOrden, _deltaKg) => {
  if (!idOrden) return;
  const order = ordersDb.find(o => o.id === idOrden || o.lote === idOrden);
  if (!order) {
    throw new Error(`No se encontró la orden de producción asociada con ID/lote: ${idOrden}`);
  }
});
