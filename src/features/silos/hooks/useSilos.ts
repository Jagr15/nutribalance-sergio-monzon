// src/features/silos/hooks/useSilos.ts
import { useState, useCallback } from 'react';
import { siloService } from '../services/siloService';
import type { Silo } from '../types/silo';

export const useSilos = () => {
  const [silos, setSilos] = useState<Silo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await siloService.getAll();
      setSilos(data);
    } catch (error) {
      console.error("Error cargando silos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = async (data: Omit<Silo, 'uid'>) => {
    setIsLoading(true);
    try {
      const nuevo = await siloService.create(data);
      setSilos((prev) => [...prev, nuevo]);
      return nuevo;
    } finally {
      setIsLoading(false);
    }
  };

  const update = async (uid: string, data: Partial<Silo>) => {
    setIsLoading(true);
    try {
      const actualizado = await siloService.update(uid, data);
      setSilos((prev) => prev.map((s) => (s.uid === uid ? actualizado : s)));
      return actualizado;
    } finally {
      setIsLoading(false);
    }
  };

// src/features/silos/hooks/useSilos.ts (o useInsumos.ts)
const remove = async (uid: string): Promise<boolean> => { // Agrega el tipo de retorno
    try {
      await siloService.delete(uid); // Este servicio devuelve void
      setSilos((prev) => prev.filter((item) => item.uid !== uid));
      return true; // <--- DEBES DEVOLVER TRUE
    } catch (error) {
      console.error("Error al eliminar:", error);
      return false; // <--- DEBES DEVOLVER FALSE
    }
  };

  return { silos, isLoading, getAll, create, update, remove };
};