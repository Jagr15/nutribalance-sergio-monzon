// src/features/insumos/hooks/useStockMateriaPrima.ts
import { useState, useCallback } from 'react';
import { stockMateriaPrimaService } from '../services/stockMateriaPrimaService';
import type { NewStockEntryData } from '../services/stockMateriaPrimaService';
import type { StockMateriaPrima, StockEnTransito } from '../types';

export const useStockMateriaPrima = () => {
  const [lotes, setLotes] = useState<StockMateriaPrima[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await stockMateriaPrimaService.findAll();
      setLotes(data);
    } catch (error) {
      console.error("Error cargando stock:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = async (data: NewStockEntryData) => {
    setIsLoading(true);
    try {
      const nuevo = await stockMateriaPrimaService.create(data);
      setLotes((prev) => [nuevo, ...prev]);
      return nuevo;
    } catch (error) {
      console.error("Error al registrar ingreso:", error);
      throw error; // Re-lanzamos para que el Modal muestre la alerta de error
    } finally {
      setIsLoading(false);
    }
  };

  const remove = async (uid: string): Promise<boolean> => {
    try {
      await stockMateriaPrimaService.delete(uid);
      setLotes((prev) => prev.filter((item) => item.uid !== uid));
      return true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Error al eliminar", { cause: error });
    }
  };

  

  const agregarStockTransito = async (uidLote: string, data: StockEnTransito) => {
    setIsLoading(true);
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
    } catch (error) {
      console.error("Error al comprometer stock:", error);
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
    } catch (error) {
      console.error("Error al liberar stock en tránsito:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { lotes, isLoading, getAll, create, remove, agregarStockTransito, eliminarStockTransitoPorOrden };
};
