// src/features/ordenes/hooks/useOrdenes.ts
import { useState, useEffect, useCallback } from 'react';
import { useOrdenService } from '../services';
import type { FinalizarOrdenPayload } from '../services/ordenService';
import type { OrdenProduccion } from '../types/orden';

export const useOrdenes = () => {
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial de datos
  const fetchOrdenes = useCallback(async () => {
    try {
      const data = await useOrdenService.getAll();
      setOrdenes(data);
      setError(null);
    } catch (err) {
      setError("Error al cargar las órdenes de producción.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchOrdenes();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchOrdenes]);

  // Iniciar producción (Transición PENDIENTE -> EN PROCESO)
  const handleStartProduction = async (id: string) => {
    try {
      const updated = await useOrdenService.startProduction(id);
      setOrdenes(prev => prev.map(o => o.id === id ? updated : o));
    } catch (err) {
      console.error("No se pudo iniciar la producción:", err);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await useOrdenService.delete(id);
      setOrdenes(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      console.error("No se pudo eliminar la orden:", err);
      throw err;
    }
  };

  // Finalizar producción (Transición EN PROCESO -> FINALIZADA)
  const handleFinishProduction = async (id: string, payload: FinalizarOrdenPayload) => {
    try {
      const updated = await useOrdenService.finishProduction(id, payload);
      setOrdenes(prev => prev.map(o => o.id === id ? updated : o));
    } catch (err) {
      console.error("Error al finalizar la orden:", err);
      throw err; // Re-lanzamos para que el modal sepa que falló
    }
  };

  return {
    ordenes,
    isLoading,
    error,
    refresh: fetchOrdenes,
    handleStartProduction,
    handleDeleteOrder,
    handleFinishProduction,
    fetchOrdenes
  };
};
