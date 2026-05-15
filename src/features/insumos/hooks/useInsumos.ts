// src/features/insumos/hooks/useInsumos.ts
import { useState, useCallback } from 'react';
import { insumoService } from '../services/insumoService';
import type { Insumo } from '../types/insumo';
import { TipoUnidad } from '../../../shared/types/global.interface';

export const useInsumos = () => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- Listar ---
  const getAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await insumoService.getAll();
      setInsumos(data);
    } catch (error) {
      console.error("Error cargando insumos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Crear ---
  const create = async (data: Omit<Insumo, 'uid'>) => {
    setIsLoading(true);
    try {
      console.log(data);
      if(data.unidad_medida === TipoUnidad.TON){
        data.umbral_alerta = data.umbral_alerta * 1000;
        data.unidad_medida = TipoUnidad.KG
      }
      const nuevo = await insumoService.create(data);
      setInsumos((prev) => [...prev, nuevo]);
      return nuevo;
    } catch (error) {
      console.error("Error al crear:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // --- Actualizar ---
  const update = async (uid: string, data: Partial<Insumo>) => {
    setIsLoading(true);
    try {
      const actualizado = await insumoService.update(uid, data);
      setInsumos((prev) => 
        prev.map((item) => (item.uid === uid ? actualizado : item))
      );
      return actualizado;
    } catch (error) {
      console.error("Error al actualizar:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // --- Eliminar ---
  const remove = async (uid: string) => {
    try {
      await insumoService.delete(uid);
      setInsumos((prev) => prev.filter((item) => item.uid !== uid));
      return true;
    } catch (error) {
      console.error("Error al eliminar:", error);
      return false;
    }
  };

  return {
    insumos,
    isLoading,
    getAll,
    create,
    update,
    remove
  };
};