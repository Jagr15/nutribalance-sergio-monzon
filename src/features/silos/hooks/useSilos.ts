// src/features/silos/hooks/useSilos.ts
import { useState, useCallback } from 'react';
import { siloService } from '../services/siloService';
import type { Silo } from '../types/silo';

export const useSilos = () => {
  const [silos, setSilos] = useState<Silo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await siloService.getAll();
      setSilos(data);
    } catch (error) {
      console.error("Error cargando silos:", error);
      setLoadError("No se pudo cargar el catálogo de silos.");
      setSilos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = async (data: Omit<Silo, 'uid'>) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nuevo = await siloService.create(data);
      setSilos((prev) => [...prev, nuevo]);
      return nuevo;
    } catch (error) {
      console.error("Error creando silo:", error);
      setLoadError("No se pudo crear el silo.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const update = async (uid: string, data: Partial<Silo>) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const actualizado = await siloService.update(uid, data);
      setSilos((prev) => prev.map((s) => (s.uid === uid ? actualizado : s)));
      return actualizado;
    } catch (error) {
      console.error("Error actualizando silo:", error);
      setLoadError("No se pudo actualizar el silo.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

// src/features/silos/hooks/useSilos.ts (o useInsumos.ts)
  const remove = async (uid: string): Promise<boolean> => {
    setLoadError(null);
    try {
      await siloService.delete(uid);
      setSilos((prev) => prev.filter((item) => item.uid !== uid));
      return true;
    } catch (error) {
      console.error("Error al eliminar:", error);
      throw error;
    }
  };

  const toggleActive = async (uid: string, activo: boolean) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const actualizado = await siloService.toggleActive(uid, activo);
      setSilos((prev) => prev.map((s) => (s.uid === uid ? actualizado : s)));
      return actualizado;
    } catch (error) {
      console.error("Error cambiando estado del silo:", error);
      setLoadError("No se pudo cambiar el estado del silo.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { silos, isLoading, getAll, create, update, remove, toggleActive, loadError };
};
