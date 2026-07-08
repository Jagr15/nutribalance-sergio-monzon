import { useState, useCallback } from 'react';
import { formulaService } from '../services/formulaService';
import type { Formula } from '../types';

export const useFormulas = () => {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Obtiene todas las fórmulas del servidor/mock.
   */
  const getAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await formulaService.getAll();
      // Ordenamos por la más reciente
      const sorted = [...data].sort((a, b) =>
        new Date(b.ultima_edicion).getTime() - new Date(a.ultima_edicion).getTime()
      );
      setFormulas(sorted);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las fórmulas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Registra una nueva fórmula.
   */
  const create = async (data: Omit<Formula, 'uid' | 'ultima_edicion'>) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nueva = await formulaService.create(data);
      setFormulas((prev) => [nueva, ...prev]);
      return nueva;
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo crear la fórmula.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Actualiza una fórmula existente.
   */
  const update = async (uid: string, data: Partial<Formula>) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const actualizada = await formulaService.update(uid, data);
      setFormulas((prev) => prev.map((f) => (f.uid === uid ? actualizada : f)));
      return actualizada;
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo actualizar la fórmula.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Desactiva una fórmula (Borrado lógico para trazabilidad).
   */
  const remove = async (uid: string): Promise<boolean> => {
    setLoadError(null);
    try {
      const success = await formulaService.delete(uid);
      if (success) {
        setFormulas((prev) =>
          prev.filter((f) => f.uid !== uid)
        );
      }
      return success;
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo desactivar la fórmula.');
      throw error;
    }
  };

  return {
    formulas,
    isLoading,
    loadError,
    getAll,
    create,
    update,
    remove
  };
};
