import { useState, useCallback } from 'react';
import { formulaService } from '../services/formulaService';
import type { Formula } from '../types';

export const useFormulas = () => {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Obtiene todas las fórmulas del servidor/mock.
   */
  const getAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await formulaService.getAll();
      // Ordenamos por la más reciente
      const sorted = data.sort((a, b) => 
        new Date(b.ultima_edicion).getTime() - new Date(a.ultima_edicion).getTime()
      );
      setFormulas(sorted);
    } catch (error) {
      console.error("Error cargando fórmulas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Registra una nueva fórmula.
   */
  const create = async (data: Omit<Formula, 'uid' | 'ultima_edicion'>) => {
    setIsLoading(true);
    try {
      const nueva = await formulaService.create(data);
      setFormulas((prev) => [nueva, ...prev]);
      return nueva;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Actualiza una fórmula existente.
   */
  const update = async (uid: string, data: Partial<Formula>) => {
    setIsLoading(true);
    try {
      const actualizada = await formulaService.update(uid, data);
      setFormulas((prev) => prev.map((f) => (f.uid === uid ? actualizada : f)));
      return actualizada;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Desactiva una fórmula (Borrado lógico para trazabilidad).
   */
  const remove = async (uid: string): Promise<boolean> => {
    try {
      const success = await formulaService.delete(uid);
      if (success) {
        setFormulas((prev) =>
          prev.map((f) => (f.uid === uid ? { ...f, esta_activa: false } : f))
        );
      }
      return success;
    } catch (error) {
      console.error("Error al desactivar:", error);
      return false;
    }
  };

  return {
    formulas,
    isLoading,
    getAll,
    create,
    update,
    remove
  };
};