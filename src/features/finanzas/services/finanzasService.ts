import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import { ApiService } from '../../../infrastructure/api';
import type { FinanzasKPIs, FinanzasReportes, MovimientoFinanciero } from '../types';
import { normalizeKpis } from '../utils/finanzasCalculations';
import { assertPermission } from '../../auth/accessControl';
import { auditAction } from '../../auth/audit';

export interface CrearMovimientoPayload {
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
  descripcion: string;
  monto: number;
  origen_operativo?: string;
  categoria_id?: string;
  centro_costo_id?: string;
  estado?: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
}
type FinanzasReportesRow = { payload?: Record<string, unknown> };
type CategoriaNested = { nombre?: string } | null;
type CentroCostoNested = { nombre?: string } | null;
type FlujoCajaMovimientoRow = {
  legacy_uid?: string | null;
  fecha: string;
  tipo: MovimientoFinanciero['tipo'];
  origen_operativo?: string | null;
  descripcion: string;
  monto?: number | string | null;
  categorias_financieras?: CategoriaNested;
  centros_costo?: CentroCostoNested;
  estado: MovimientoFinanciero['estado'];
};

const emptyReportes: FinanzasReportes = {
  flujo_caja_mensual: [],
  gastos_por_categoria: [],
  ingresos_por_categoria: [],
  rentabilidad_por_formula: [],
  costo_operativo_mensual: [],
};

export const finanzasService = {
  async getKPIs(): Promise<FinanzasKPIs> {
    const { data, error } = await supabaseClient.from('vw_finanzas_kpis').select('*').single<Record<string, unknown>>();
    if (error) throw error;
    return normalizeKpis(data ?? {});
  },

  async getReportes(): Promise<FinanzasReportes> {
    const { data, error } = await supabaseClient.from('vw_finanzas_reportes').select('payload').single<FinanzasReportesRow>();
    if (error) throw error;
    const payload = (data?.payload ?? {}) as Record<string, unknown>;
    const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
    return {
      flujo_caja_mensual: asArray<FinanzasReportes['flujo_caja_mensual'][number]>(payload.flujo_caja_mensual),
      gastos_por_categoria: asArray<FinanzasReportes['gastos_por_categoria'][number]>(payload.gastos_por_categoria),
      ingresos_por_categoria: asArray<FinanzasReportes['ingresos_por_categoria'][number]>(payload.ingresos_por_categoria),
      rentabilidad_por_formula: asArray<FinanzasReportes['rentabilidad_por_formula'][number]>(payload.rentabilidad_por_formula),
      costo_operativo_mensual: asArray<FinanzasReportes['costo_operativo_mensual'][number]>(payload.costo_operativo_mensual),
    };
  },

  async getMovimientos(): Promise<MovimientoFinanciero[]> {
    const { data, error } = await supabaseClient
      .from('flujo_caja_movimientos')
      .select('legacy_uid,fecha,tipo,origen_operativo,descripcion,monto,estado,categorias_financieras(nombre),centros_costo(nombre)')
      .is('deleted_at', null)
      .order('fecha', { ascending: false });

    if (error) throw error;
    return ((data ?? []) as FlujoCajaMovimientoRow[]).map((row) => ({
      uid: row.legacy_uid ?? crypto.randomUUID(),
      fecha: row.fecha,
      tipo: row.tipo,
      origen_operativo: row.origen_operativo ?? undefined,
      descripcion: row.descripcion,
      monto: Number(row.monto ?? 0),
      categoria: row.categorias_financieras?.nombre,
      centro_costo: row.centros_costo?.nombre,
      estado: row.estado,
    }));
  },

  async createMovimiento(payload: CrearMovimientoPayload): Promise<void> {
    assertPermission('finanzas', 'register_financial_movement');
    const descripcion = payload.descripcion?.trim();
    if (!descripcion) {
      throw new Error('La descripción es obligatoria.');
    }
    if (!Number.isFinite(payload.monto) || payload.monto <= 0) {
      throw new Error('El monto debe ser mayor a 0.');
    }
    if (!['INGRESO', 'EGRESO', 'TRANSFERENCIA'].includes(payload.tipo)) {
      throw new Error('Tipo de movimiento inválido.');
    }
    const uniqueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `fin-${crypto.randomUUID()}`
      : `fin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const { error } = await supabaseClient.from('flujo_caja_movimientos').insert({
      legacy_uid: uniqueId,
      fecha: new Date().toISOString(),
      tipo: payload.tipo,
      descripcion,
      monto: payload.monto,
      origen_operativo: payload.origen_operativo ?? 'MANUAL',
      categoria_id: payload.categoria_id ?? null,
      centro_costo_id: payload.centro_costo_id ?? null,
      estado: payload.estado ?? 'CONFIRMADO',
      metadata: {},
    });

    if (error) throw error;
    await auditAction({
      modulo: 'finanzas',
      accion: 'register_financial_movement',
      entidad: 'flujo_caja_movimiento',
      payload: {
        tipo: payload.tipo,
        descripcion,
        monto: payload.monto,
        origen_operativo: payload.origen_operativo ?? 'MANUAL',
      },
    });
  },

  async getOperationalFallback(): Promise<{ kpis: FinanzasKPIs; reportes: FinanzasReportes; movimientos: MovimientoFinanciero[] }> {
    const [ordenes, lotes, formulas] = await Promise.all([
      ApiService.ordenes.getAll(),
      ApiService.stockMP.getAllLotes(),
      ApiService.formulas.findAll(),
    ]);

    const costoProduccion = ordenes.reduce((acc, orden) => acc + Number(orden.costo_total_insumos ?? 0), 0);
    const valorizacionInventario = lotes.reduce(
      (acc, lote) => acc + Number(lote.cantidad_actual ?? 0) * Number(lote.costo_unitario ?? 0),
      0,
    );

    const perdidaMerma = ordenes.reduce((acc, orden) => {
      const mermaPct = Number(orden.merma_manual ?? 0);
      const cantidadObjetivo = Number(orden.cantidad_objetivo ?? 0);
      const costoUnitEstimado = cantidadObjetivo > 0
        ? Number(orden.costo_total_insumos ?? 0) / cantidadObjetivo
        : 0;
      return acc + ((mermaPct / 100) * cantidadObjetivo * costoUnitEstimado);
    }, 0);

    const costoPorMesMap = new Map<string, number>();
    ordenes.forEach((orden) => {
      const date = new Date(orden.fecha_creacion);
      if (Number.isNaN(date.getTime())) return;
      const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      costoPorMesMap.set(mes, (costoPorMesMap.get(mes) ?? 0) + Number(orden.costo_total_insumos ?? 0));
    });
    const costoOperativoMensual = [...costoPorMesMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, monto]) => ({ mes, monto }));

    const flujoCajaMensual = costoOperativoMensual.map(({ mes, monto }) => ({
      mes,
      ingresos: 0,
      egresos: monto,
      neto: -monto,
    }));

    const formulasCostMap = new Map(
      formulas.map((f) => [f.uid, Number(f.costo_por_kg ?? 0)]),
    );
    const rentabilidadPorFormula = formulas.map((f) => {
      const kgTotal = ordenes
        .filter((orden) => orden.id_formula === f.uid || orden.nombre_producto === f.nombre_producto)
        .reduce((acc, orden) => acc + Number(orden.cantidad_objetivo ?? 0), 0);
      return {
        id_formula: f.uid,
        nombre_producto: f.nombre_producto,
        costo_total: kgTotal * Number(f.costo_por_kg ?? 0),
        kg_total: kgTotal,
        costo_promedio_kg: Number(f.costo_por_kg ?? 0),
      };
    }).filter((row) => row.costo_total > 0 || row.kg_total > 0 || formulasCostMap.get(row.id_formula));

    const reportes: FinanzasReportes = {
      ...emptyReportes,
      flujo_caja_mensual: flujoCajaMensual,
      gastos_por_categoria: [
        { categoria: 'Producción', monto: costoProduccion },
        { categoria: 'Merma', monto: perdidaMerma },
      ].filter((row) => row.monto > 0),
      ingresos_por_categoria: [],
      rentabilidad_por_formula: rentabilidadPorFormula,
      costo_operativo_mensual: costoOperativoMensual,
    };

    const kpis: FinanzasKPIs = {
      saldo_actual: 0,
      ingresos_mes: 0,
      egresos_mes: flujoCajaMensual.length > 0 ? flujoCajaMensual[flujoCajaMensual.length - 1].egresos : 0,
      flujo_neto: flujoCajaMensual.length > 0 ? flujoCajaMensual[flujoCajaMensual.length - 1].neto : 0,
      margen_operativo: 0,
      costo_produccion: costoProduccion,
      valorizacion_inventario: valorizacionInventario,
      cuentas_por_pagar: 0,
      cuentas_por_cobrar: 0,
      perdida_merma: perdidaMerma,
    };

    return { kpis, reportes, movimientos: [] };
  },
};
