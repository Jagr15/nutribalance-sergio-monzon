// src/features/formulas/utils/costCalculator.ts
import type { Ingrediente } from '../types'; 
import type { StockMateriaPrima, Insumo } from '../../insumos/types';

export const calculateFormulaCost = (
  ingredientes: Ingrediente[],
  maestroStock: StockMateriaPrima[],
  maestroInsumos: Insumo[] // Añadimos el maestro como tercer parámetro
): number => {
  return ingredientes.reduce((total, item) => {
    if (!item.id_insumo || !item.porcentaje) return total;

    // 1. Intentar obtener el costo del último lote
    const lotesInsumo = maestroStock.filter(s => s.id_insumo === item.id_insumo);
    
    let costoUnitario = 0;

    if (lotesInsumo.length > 0) {
      const ultimoLote = lotesInsumo.sort((a, b) => 
        new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime()
      )[0];
      costoUnitario = ultimoLote.costo_unitario || 0;
    }

    // 2. Si no hay lotes (costo 0), buscar ref_costo_unitario en el maestro
    if (costoUnitario === 0) {
      const insumoData = maestroInsumos.find(ins => ins.uid === item.id_insumo);
      console.log("no hay lote", insumoData)
      costoUnitario = insumoData?.ref_costo_unitario || 0;
    }
    console.log("costo unit", costoUnitario)
    const costoContribucion = costoUnitario * item.porcentaje;
    console.log("costo aprox", costoContribucion)
    return total + costoContribucion;
  }, 0);
};