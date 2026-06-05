// src/features/insumos/hooks/useStockMateriaPrima.ts
import { useState, useCallback, useRef } from 'react';
import { stockMateriaPrimaService } from '../services/stockMateriaPrimaService';
import type { NewStockEntryData } from '../services/stockMateriaPrimaService';
import type { StockMateriaPrima, StockEnTransito } from '../types';

export const useStockMateriaPrima = () => {
  const [lotes, setLotes] = useState<StockMateriaPrima[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const getAll = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await stockMateriaPrimaService.findAll();
      setLotes(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el stock de materia prima.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const create = async (data: NewStockEntryData) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nuevo = await stockMateriaPrimaService.create(data);
      setLotes((prev) => [nuevo, ...prev]);
      return nuevo;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el ingreso.';
      setLoadError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const remove = async (uid: string): Promise<boolean> => {
    setLoadError(null);
    try {
      await stockMateriaPrimaService.delete(uid);
      setLotes((prev) => prev.filter((item) => item.uid !== uid));
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo desactivar el lote.';
      setLoadError(message);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('No se pudo desactivar el lote.', { cause: error });
    }
  };

  

  const agregarStockTransito = async (uidLote: string, data: StockEnTransito) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // 1. Buscamos el lote actual para obtener su estado actual
      const loteActual = lotes.find(l => l.uid === uidLote);
      if (!loteActual) throw new Error("Lote no encontrado");

      // 2. Preparamos el nuevo arreglo de tránsito (asumiendo que puede haber varios)
      // Si tu modelo solo permite uno por lote, quita el spread.
      const nuevoStockTransito = data; 
      
      // 3. Calculamos la nueva cantidad comprometida
      // Si permites múltiples, sumarías. Si es 1 a 1 como en tu interface:
      const nuevaCantidadComprometida = (loteActual.cantidad_comprometida || 0) + data.cantidad;

      const updateData: Partial<StockMateriaPrima> = {
        stock_transito: nuevoStockTransito,
        cantidad_comprometida: nuevaCantidadComprometida,
        updatedAt: new Date()
      };

      const actualizado = await stockMateriaPrimaService.update(uidLote, updateData);
      
      // Actualizamos el estado local
      setLotes(prev => prev.map(l => l.uid === uidLote ? actualizado : l));
      return actualizado;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo comprometer stock en tránsito.';
      setLoadError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 2. ELIMINAR STOCK EN TRÁNSITO / LIBERAR
   * Busca por id_orden dentro de los lotes para limpiar el tránsito y restar el compromiso
   */
  const eliminarStockTransitoPorOrden = async (idOrden: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // 1. Encontrar qué lote tiene esa orden en tránsito
      const loteAfectado = lotes.find(l => l.stock_transito?.id_orden === idOrden);
      
      if (!loteAfectado || !loteAfectado.stock_transito) {
        console.warn("No se encontró lote con esa orden en tránsito");
        return;
      }

      const cantidadARestar = loteAfectado.stock_transito.cantidad;
      const nuevaCantidadComprometida = Math.max(0, (loteAfectado.cantidad_comprometida || 0) - cantidadARestar);

      // 2. Preparamos el update para limpiar el campo (null/undefined)
      const updateData: Partial<StockMateriaPrima> = {
        stock_transito: undefined,
        cantidad_comprometida: nuevaCantidadComprometida,
        updatedAt: new Date()
      };

      const actualizado = await stockMateriaPrimaService.update(loteAfectado.uid, updateData);

      // Actualizamos el estado local
      setLotes(prev => prev.map(l => l.uid === loteAfectado.uid ? actualizado : l));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo liberar el stock en tránsito.';
      setLoadError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { lotes, isLoading, loadError, getAll, create, remove, agregarStockTransito, eliminarStockTransitoPorOrden };
};
