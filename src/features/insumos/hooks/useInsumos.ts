// src/features/insumos/hooks/useInsumos.ts
import { useState, useCallback } from 'react';
import { insumoService } from '../services/insumoService';
import type { Insumo } from '../types/insumo';
import { TipoUnidad } from '../../../shared/types/global.interface';

export const useInsumos = () => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Listar ---
  const getAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await insumoService.getAll();
      setInsumos(data);
    } catch (error) {
      console.error("Error cargando insumos:", error);
      setLoadError("No se pudo cargar el catálogo de insumos.");
      setInsumos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Crear ---
  const create = async (data: Omit<Insumo, 'uid'>) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const normalized = { ...data };
      if (normalized.unidad_medida === TipoUnidad.TON) {
        normalized.umbral_alerta = normalized.umbral_alerta * 1000;
        normalized.unidad_medida = TipoUnidad.KG;
      }
      const nuevo = await insumoService.create(normalized);
      setInsumos((prev) => [...prev, nuevo]);
      return nuevo;
    } catch (error) {
      console.error("Error al crear:", error);
      setLoadError("No se pudo crear el insumo.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // --- Actualizar ---
  const update = async (uid: string, data: Partial<Insumo>) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const actualizado = await insumoService.update(uid, data);
      setInsumos((prev) => 
        prev.map((item) => (item.uid === uid ? actualizado : item))
      );
      return actualizado;
    } catch (error) {
      console.error("Error al actualizar:", error);
      setLoadError("No se pudo actualizar el insumo.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // --- Eliminar ---
  const remove = async (uid: string) => {
    setLoadError(null);
    try {
      await insumoService.delete(uid);
      setInsumos((prev) => prev.filter((item) => item.uid !== uid));
      return true;
    } catch (error) {
      console.error("Error al eliminar:", error);
      throw error;
    }
  };

  return {
    insumos,
    isLoading,
    getAll,
    create,
    update,
    remove,
    loadError
  };
};
