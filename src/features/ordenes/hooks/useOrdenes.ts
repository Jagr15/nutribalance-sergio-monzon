// src/features/ordenes/hooks/useOrdenes.ts
import { useState, useEffect, useCallback } from 'react';
import { useOrdenService } from '../services';
import type { OrdenProduccion } from '../types/orden';

export const useOrdenes = () => {
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial de datos
  const fetchOrdenes = useCallback(async () => {
    setIsLoading(true);
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
    fetchOrdenes();
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

  // Finalizar producción (Transición EN PROCESO -> FINALIZADA)
  const handleFinishProduction = async (id: string, payload: any) => {
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
    handleFinishProduction,
    fetchOrdenes
  };
};