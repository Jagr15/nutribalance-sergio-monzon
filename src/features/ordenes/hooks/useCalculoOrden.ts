// src/features/ordenes/hooks/useCalculoOrden.ts
import { useCallback, useState } from 'react';
import { stockMateriaPrimaService } from '../../insumos/services/stockMateriaPrimaService';
import type { Formula } from '../../formulas/types';
import type { StockMateriaPrima } from '../../insumos/types'; // Asegúrate de importar la interfaz
import type { DetalleInsumoLote } from '../types/orden';
import { TipoUnidad } from '../../../shared/types/global.interface';
import { buildStockRequirementRows, type StockLoteForFlow } from '../utils/productionFlow';

export interface CalculoOrdenResultado {
  inversionTotal: number;
  costoPorKg: number;
  lotesInvolucrados: DetalleInsumoLote[];
  stockSuficiente: boolean;
  ingredientesFaltantes: string[];
  resumenInsumos: Array<{
    nombre_insumo: string;
    disponible: number;
    requerida: number;
    faltante: number;
  }>;
}

export const useCalculoOrden = () => {
  const [isCalculando, setIsCalculando] = useState(false);

  const calcularInversionLote = useCallback(async (cantidadObjetivo: number, formula: Formula): Promise<CalculoOrdenResultado | null> => {
    if (!cantidadObjetivo || !formula) return null;
    
    setIsCalculando(true);
    try {
      const todosLosLotes: StockMateriaPrima[] = await stockMateriaPrimaService.findAll();
      const lotesFlow: StockLoteForFlow[] = todosLosLotes.map((lote) => ({
        id: lote.uid,
        legacy_uid: lote.uid,
        lote: lote.lote,
        insumo_id: lote.id_insumo,
        insumo_legacy_uid: lote.id_insumo,
        insumo_nombre: lote.id_insumo,
        fecha_ingreso: lote.fecha_ingreso.toISOString(),
        cantidad_actual: lote.cantidad_actual,
        cantidad_comprometida: lote.cantidad_comprometida,
        costo_unitario: lote.costo_unitario,
      }));
      let inversionTotal = 0;
      const lotesInvolucrados: DetalleInsumoLote[] = [];
      const ingredientesFaltantes: string[] = []; 
      let stockSuficienteGlobal = true;

      for (const ingrediente of formula.ingredientes) {
        const cantidadNecesaria = cantidadObjetivo * (ingrediente.porcentaje / 100);
        let cantidadPendiente = cantidadNecesaria;

        // 1. Filtrar lotes que tengan stock DISPONIBLE real (actual - comprometido)
        const lotesDelInsumo = todosLosLotes
          .filter(lote => {
            const disponible = lote.cantidad_actual - (lote.cantidad_comprometida || 0);
            return (lote.insumo_id === ingrediente.id_insumo || lote.id_insumo === ingrediente.id_insumo) && disponible > 0;
          })
          .sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime());

        for (const lote of lotesDelInsumo) {
          if (cantidadPendiente <= 0) break;

          // 2. Calcular disponibilidad real de este lote específico
          const disponibleReal = lote.cantidad_actual - (lote.cantidad_comprometida || 0);
          
          // 3. Tomar lo mínimo entre lo que falta y lo que realmente hay disponible
          const cantidadATomar = Math.min(disponibleReal, cantidadPendiente);
          const costoTramo = cantidadATomar * lote.costo_unitario;

          inversionTotal += costoTramo;
          cantidadPendiente -= cantidadATomar;

          lotesInvolucrados.push({
            id_lote: lote.lote,
            id_insumo: ingrediente.id_insumo,
            nombre_insumo: ingrediente.nombre_insumo,
            cantidad_usada: cantidadATomar,
            tipo_unidad: TipoUnidad.KG,
            costo_unitario: lote.costo_unitario,
            costo_total: costoTramo
          });
        }

        // Tolerancia para evitar errores por decimales
        if (cantidadPendiente > 0.01) {
          stockSuficienteGlobal = false;
          ingredientesFaltantes.push(ingrediente.nombre_insumo);
        }
      }

      return {
        inversionTotal,
        costoPorKg: inversionTotal / cantidadObjetivo,
        lotesInvolucrados,
        stockSuficiente: stockSuficienteGlobal,
        ingredientesFaltantes,
        resumenInsumos: buildStockRequirementRows(cantidadObjetivo, formula.ingredientes, lotesFlow),
      };
    } catch (error) {
      console.error("Error en el cálculo FIFO con stock comprometido:", error);
      return null;
    } finally {
      setIsCalculando(false);
    }
  }, []);

  return { calcularInversionLote, isCalculando };
};
