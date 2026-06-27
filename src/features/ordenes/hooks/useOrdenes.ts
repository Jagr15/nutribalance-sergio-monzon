// src/features/ordenes/hooks/useOrdenes.ts
import { useState, useEffect, useCallback } from 'react';
import { useOrdenService } from '../services';
import type { FinalizarOrdenPayload } from '../services/ordenService';
import type { OrdenProduccion } from '../types/orden';

export const useOrdenes = () => {
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message.trim()) return err.message;
    if (err && typeof err === 'object') {
      const candidate = err as { message?: string; details?: string; hint?: string };
      return [candidate.message, candidate.details, candidate.hint].filter(Boolean).join(' | ') || fallback;
    }
    return fallback;
  };

  // Carga inicial de datos
  const fetchOrdenes = useCallback(async () => {
    try {
      const data = await useOrdenService.getAll();
      setOrdenes(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Error al cargar las órdenes de producción."));
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
    setError(null);
    try {
      const updated = await useOrdenService.startProduction(id);
      setOrdenes(prev => prev.map(o => o.id === id ? updated : o));
      return updated;
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo iniciar la producción.");
      setError(message);
      throw err;
    }
  };

  const handleDeleteOrder = async (id: string) => {
    setError(null);
    try {
      await useOrdenService.delete(id);
      setOrdenes(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo anular la orden.");
      setError(message);
      throw err;
    }
  };

  // Finalizar producción (Transición EN PROCESO -> FINALIZADA)
  const handleFinishProduction = async (id: string, payload: FinalizarOrdenPayload) => {
    setError(null);
    try {
      const updated = await useOrdenService.finishProduction(id, payload);
      setOrdenes(prev => prev.map(o => o.id === id ? updated : o));
      window.dispatchEvent(new Event('stock-pt-updated'));
      return updated;
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo finalizar la orden.");
      setError(message);
      throw err;
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
