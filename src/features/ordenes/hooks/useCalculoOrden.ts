// src/features/ordenes/hooks/useCalculoOrden.ts
import { useState } from 'react';
import { stockMateriaPrimaService } from '../../insumos/services/stockMateriaPrimaService';
import type { Formula } from '../../formulas/types';
import type { StockMateriaPrima } from '../../insumos/types'; // Asegúrate de importar la interfaz

export const useCalculoOrden = () => {
  const [isCalculando, setIsCalculando] = useState(false);

  const calcularInversionLote = async (cantidadObjetivo: number, formula: Formula) => {
    if (!cantidadObjetivo || !formula) return null;
    
    setIsCalculando(true);
    try {
      const todosLosLotes: StockMateriaPrima[] = await stockMateriaPrimaService.findAll();
      let inversionTotal = 0;
      const lotesInvolucrados: any[] = [];
      const ingredientesFaltantes: string[] = []; 
      let stockSuficienteGlobal = true;

      for (const ingrediente of formula.ingredientes) {
        const cantidadNecesaria = cantidadObjetivo * (ingrediente.porcentaje / 100);
        let cantidadPendiente = cantidadNecesaria;

        // 1. Filtrar lotes que tengan stock DISPONIBLE real (actual - comprometido)
        const lotesDelInsumo = todosLosLotes
          .filter(lote => {
            const disponible = lote.cantidad_actual - (lote.cantidad_comprometida || 0);
            return lote.id_insumo === ingrediente.id_insumo && disponible > 0;
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
        ingredientesFaltantes 
      };
    } catch (error) {
      console.error("Error en el cálculo FIFO con stock comprometido:", error);
      return null;
    } finally {
      setIsCalculando(false);
    }
  };

  return { calcularInversionLote, isCalculando };
};