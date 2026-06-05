import { useEffect, useState } from 'react';
import { dashboardOperativoService } from '../services/dashboardOperativoService';
import type { ConsumoMensualInsumo, DashboardOperativoKPIs, FormulaComposicion } from '../types/operativo';

const EMPTY_KPI: DashboardOperativoKPIs = {
  stock_total_mp: 0,
  stock_critico: 0,
  ordenes_pendientes: 0,
  ordenes_en_proceso: 0,
  ordenes_finalizadas: 0,
  produccion_total: 0,
  costo_promedio_produccion: 0,
  merma_total: 0,
  valor_inventario_mp: 0,
  valor_inventario_pt: 0,
  proteina_promedio_formula: 0,
};

export const useDashboardOperativo = () => {
  const [kpis, setKpis] = useState<DashboardOperativoKPIs>(EMPTY_KPI);
  const [formulas, setFormulas] = useState<FormulaComposicion[]>([]);
  const [consumoMensual, setConsumoMensual] = useState<ConsumoMensualInsumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [kpiData, extra] = await Promise.all([
          dashboardOperativoService.getKPIs(),
          dashboardOperativoService.getComposicionYConsumo(),
        ]);
        setKpis(kpiData);
        setFormulas(extra.formulas);
        setConsumoMensual(extra.consumoMensual);
      } catch (error) {
        console.error('Error cargando dashboard operativo:', error);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return { kpis, formulas, consumoMensual, loading };
};
