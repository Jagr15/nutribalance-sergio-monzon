import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';
import { ApiService } from '../../../infrastructure/api';
import type { MovimientoStockPT } from '../../productos/types';
import type {
  CostosFormulaVsReal,
  FinanzasInventarioResumen,
  FinanzasKPIs,
  FinanzasReportes,
  FinanzasTesoreriaInsights,
  MovimientoFinanciero,
  RubroFinancieroCatalogo,
} from '../types';
import { normalizeKpis } from '../utils/finanzasCalculations';
import { buildCostosFormulaVsReal } from '../utils/costosFormulaVsReal';
import { buildIngresosPtPorProducto } from '../utils/ingresosPtPorProducto';
import { buildTesoreriaInsights } from '../utils/tesoreriaInsights';
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
type CostosFormulaVsRealRow = {
  producto_formula_id: string | null;
  nombre_producto: string;
  version_formula: number | null;
  costo_formulado_kg: number | string | null;
  costo_formulado_ton: number | string | null;
  costo_real_kg: number | string | null;
  costo_real_ton: number | string | null;
  variacion_abs: number | string | null;
  variacion_pct: number | string | null;
  ultima_op: string | null;
};
type ChequeTesoreriaDbRow = {
  id: string;
  numero: string;
  tipo: 'EMITIDO' | 'RECIBIDO';
  tercero: string;
  importe: number | string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'PENDIENTE' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'VENCIDO';
  cliente_id: string | null;
  cliente_nombre: string | null;
};
type CuentasBancariasSaldoRow = {
  saldo_actual: number | string | null;
};
type CategoriaFinancieraDbRow = {
  id: string;
  legacy_uid: string | null;
  nombre: string;
  tipo_movimiento: 'INGRESO' | 'EGRESO';
  area: string | null;
  deleted_at: string | null;
};
type FlujoCajaRubroDbRow = {
  fecha: string;
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
  origen_operativo: string | null;
  descripcion: string;
  monto: number | string | null;
  categoria: string | null;
  centro_costo: string | null;
};
type ComprobanteCarteraDbRow = {
  cliente_id: string | null;
  tercero: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  estado: string;
  saldo: number | string | null;
  tipo: string;
};
type PresupuestoDbRow = {
  anio: number;
  mes: number;
  monto_presupuestado: number | string | null;
  categorias_financieras?: { nombre: string | null } | null;
  centros_costo?: { nombre: string | null } | null;
};
type StockPTMovimientoVentaRow = {
  cliente_id: string | null;
  created_at: string;
  tipo: string;
  stock_pt_id?: string | null;
  nombre_producto?: string | null;
  cantidad?: number | string | null;
  costo_unitario?: number | string | null;
  valor_total?: number | string | null;
  cliente_nombre?: string | null;
};

const emptyReportes: FinanzasReportes = {
  flujo_caja_mensual: [],
  gastos_por_categoria: [],
  ingresos_por_categoria: [],
  ingresos_pt_por_producto: [],
  rentabilidad_por_formula: [],
  costo_operativo_mensual: [],
};

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
const num = (value: unknown) => Number(value ?? 0);
const rubrosStorageKey = 'nutribalance_categorias_financieras_v1';
const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const defaultRubros = (): RubroFinancieroCatalogo[] => [
  { id: 'cat-materia-prima', nombre: 'Materia prima', tipo: 'EGRESO', activo: true, area: 'Operaciones' },
  { id: 'cat-produccion', nombre: 'Producción', tipo: 'EGRESO', activo: true, area: 'Operaciones' },
  { id: 'cat-logistica', nombre: 'Logística', tipo: 'EGRESO', activo: true, area: 'Operaciones' },
  { id: 'cat-nomina', nombre: 'Nómina', tipo: 'EGRESO', activo: true, area: 'Administración' },
  { id: 'cat-servicios', nombre: 'Servicios', tipo: 'EGRESO', activo: true, area: 'Administración' },
  { id: 'cat-marketing', nombre: 'Marketing', tipo: 'EGRESO', activo: true, area: 'Comercial' },
  { id: 'cat-otros', nombre: 'Otros', tipo: 'EGRESO', activo: true, area: null },
];

const readMockRubros = (): RubroFinancieroCatalogo[] => {
  if (typeof window === 'undefined') return defaultRubros();
  try {
    const raw = window.localStorage.getItem(rubrosStorageKey);
    if (!raw) return defaultRubros();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RubroFinancieroCatalogo[]) : defaultRubros();
  } catch {
    return defaultRubros();
  }
};

const writeMockRubros = (rows: RubroFinancieroCatalogo[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(rubrosStorageKey, JSON.stringify(rows));
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
      ingresos_pt_por_producto: asArray<FinanzasReportes['ingresos_pt_por_producto'][number]>(payload.ingresos_pt_por_producto),
      rentabilidad_por_formula: asArray<FinanzasReportes['rentabilidad_por_formula'][number]>(payload.rentabilidad_por_formula),
      costo_operativo_mensual: asArray<FinanzasReportes['costo_operativo_mensual'][number]>(payload.costo_operativo_mensual),
    };
  },

  async getTreasuryInsights(): Promise<FinanzasTesoreriaInsights> {
    const [presupuestosResult, flujoResult, comprobantesResult, chequesResult, ventasPtResult, saldoResult, clientes] = await Promise.all([
      supabaseClient
        .from('presupuestos_mensuales')
        .select('anio,mes,monto_presupuestado,categorias_financieras(nombre),centros_costo(nombre)')
        .is('deleted_at', null)
        .order('anio', { ascending: false }),
      supabaseClient
        .from('flujo_caja_movimientos')
        .select('fecha,tipo,origen_operativo,descripcion,monto,categorias_financieras(nombre),centros_costo(nombre)')
        .is('deleted_at', null)
        .eq('estado', 'CONFIRMADO')
        .order('fecha', { ascending: false }),
      supabaseClient
        .from('comprobantes')
        .select('cliente_id,tercero,fecha_emision,fecha_vencimiento,estado,saldo,tipo')
        .is('deleted_at', null)
        .order('fecha_vencimiento', { ascending: true }),
      supabaseClient
        .from('tesoreria_cheques')
        .select('id,numero,tipo,tercero,importe,fecha_emision,fecha_vencimiento,estado,cliente_id,cliente_nombre')
        .is('deleted_at', null)
        .order('fecha_vencimiento', { ascending: true }),
      supabaseClient
        .from('stock_pt_movimientos')
        .select('cliente_id,created_at,tipo')
        .order('created_at', { ascending: false }),
      supabaseClient
        .from('cuentas_bancarias')
        .select('saldo_actual')
        .is('deleted_at', null),
      ApiService.clientes.getAll(),
    ]);

    if (presupuestosResult.error) throw presupuestosResult.error;
    if (flujoResult.error) throw flujoResult.error;
    if (comprobantesResult.error) throw comprobantesResult.error;
    if (chequesResult.error) throw chequesResult.error;
    if (ventasPtResult.error) throw ventasPtResult.error;
    if (saldoResult.error) throw saldoResult.error;

    const presupuestos = ((presupuestosResult.data ?? []) as unknown as PresupuestoDbRow[]).map((row) => ({
      anio: row.anio,
      mes: row.mes,
      monto_presupuestado: row.monto_presupuestado,
      categoria: row.categorias_financieras?.nombre ?? null,
      centro_costo: row.centros_costo?.nombre ?? null,
    }));
    const flujo = ((flujoResult.data ?? []) as unknown as FlujoCajaRubroDbRow[]).map((row) => ({
      fecha: row.fecha,
      tipo: row.tipo,
      origen_operativo: row.origen_operativo,
      descripcion: row.descripcion,
      monto: row.monto,
      categoria: row.categoria ?? null,
      centro_costo: row.centro_costo ?? null,
    }));
    const comprobantes = (comprobantesResult.data ?? []) as ComprobanteCarteraDbRow[];
    const cheques = ((chequesResult.data ?? []) as ChequeTesoreriaDbRow[]).map((row) => ({
      ...row,
      importe: Number(row.importe ?? 0),
    }));
    const ventasPt = (ventasPtResult.data ?? []) as StockPTMovimientoVentaRow[];
    const saldoActual = ((saldoResult.data ?? []) as CuentasBancariasSaldoRow[]).reduce((acc, row) => acc + Number(row.saldo_actual ?? 0), 0);

    return buildTesoreriaInsights(
      presupuestos,
      flujo,
      clientes,
      comprobantes,
      ventasPt as unknown as MovimientoStockPT[],
      cheques,
      saldoActual,
      { rubros: await finanzasService.getRubrosFinancieros() },
    );
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

  async getCostosComparativos(): Promise<CostosFormulaVsReal[]> {
    const { data, error } = await supabaseClient
      .from('vw_costos_formula_vs_real')
      .select('producto_formula_id,nombre_producto,version_formula,costo_formulado_kg,costo_formulado_ton,costo_real_kg,costo_real_ton,variacion_abs,variacion_pct,ultima_op')
      .order('nombre_producto', { ascending: true });

    if (error) throw error;

    return ((data ?? []) as CostosFormulaVsRealRow[]).map((row) => ({
      producto_formula_id: row.producto_formula_id ?? '',
      nombre_producto: row.nombre_producto,
      version_formula: row.version_formula === null ? null : Number(row.version_formula),
      costo_formulado_kg: num(row.costo_formulado_kg),
      costo_formulado_ton: num(row.costo_formulado_ton),
      costo_real_kg: num(row.costo_real_kg),
      costo_real_ton: num(row.costo_real_ton),
      variacion_abs: num(row.variacion_abs),
      variacion_pct: num(row.variacion_pct),
      ultima_op: row.ultima_op,
    }));
  },

  async getInventarioResumen(): Promise<FinanzasInventarioResumen> {
    const [lotesMp, resumenPt] = await Promise.all([
      ApiService.stockMP.getAllLotes(),
      ApiService.stockPT.getResumen(),
    ]);

    const valorStockMp = sum(lotesMp.map((lote) => Number(lote.cantidad_actual ?? 0) * Number(lote.costo_unitario ?? 0)));
    const valorStockPt = sum(resumenPt.map((item) => Number(item.valor_monetario ?? 0)));
    return {
      valor_stock_mp: valorStockMp,
      valor_stock_pt: valorStockPt,
      valor_inventario_total: valorStockMp + valorStockPt,
    };
  },

  async getRubrosFinancieros(): Promise<RubroFinancieroCatalogo[]> {
    if (runtimeConfig.mode === 'mock') return readMockRubros();
    const { data, error } = await supabaseClient.from('categorias_financieras').select('id,legacy_uid,nombre,tipo_movimiento,area,deleted_at').order('nombre', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as CategoriaFinancieraDbRow[]).map((row) => ({
      id: row.id,
      nombre: row.nombre,
      tipo: row.tipo_movimiento,
      activo: row.deleted_at === null,
      area: row.area,
    }));
  },

  async saveRubroFinanciero(payload: { id?: string; nombre: string; tipo: 'INGRESO' | 'EGRESO'; activo: boolean; area?: string | null }): Promise<RubroFinancieroCatalogo> {
    const nombre = payload.nombre.trim();
    if (!nombre) throw new Error('El nombre del rubro es obligatorio.');
    if (!payload.tipo) throw new Error('El tipo del rubro es obligatorio.');

    if (runtimeConfig.mode === 'mock') {
      const rows = readMockRubros();
      const duplicate = rows.find((row) => normalizeName(row.nombre) === normalizeName(nombre) && row.tipo === payload.tipo && row.id !== payload.id);
      if (duplicate) throw new Error('Ya existe un rubro con ese nombre para ese tipo.');
      const next: RubroFinancieroCatalogo = { id: payload.id ?? `cat-${Date.now()}`, nombre, tipo: payload.tipo, activo: payload.activo, area: payload.area ?? null };
      const updated = rows.some((row) => row.id === next.id) ? rows.map((row) => (row.id === next.id ? next : row)) : [...rows, next];
      writeMockRubros(updated);
      return next;
    }

    const query = payload.id
      ? supabaseClient
          .from('categorias_financieras')
          .update({ nombre, tipo_movimiento: payload.tipo, area: payload.area ?? null, updated_at: new Date().toISOString(), deleted_at: payload.activo ? null : new Date().toISOString() })
          .eq('id', payload.id)
          .select('id,legacy_uid,nombre,tipo_movimiento,area,deleted_at')
          .single<CategoriaFinancieraDbRow>()
      : supabaseClient
          .from('categorias_financieras')
          .insert({ nombre, tipo_movimiento: payload.tipo, area: payload.area ?? null, deleted_at: null })
          .select('id,legacy_uid,nombre,tipo_movimiento,area,deleted_at')
          .single<CategoriaFinancieraDbRow>();
    const { data, error } = await query;
    if (error) throw error;
    return { id: data.id, nombre: data.nombre, tipo: data.tipo_movimiento, activo: data.deleted_at === null, area: data.area };
  },

  async toggleRubroFinanciero(id: string, activo: boolean): Promise<void> {
    if (runtimeConfig.mode === 'mock') {
      writeMockRubros(readMockRubros().map((row) => (row.id === id ? { ...row, activo } : row)));
      return;
    }
    const { error } = await supabaseClient
      .from('categorias_financieras')
      .update({ deleted_at: activo ? null : new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
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

  async getOperationalFallback(): Promise<{ kpis: FinanzasKPIs; reportes: FinanzasReportes; tesoreria: FinanzasTesoreriaInsights; movimientos: MovimientoFinanciero[]; costosComparativos: CostosFormulaVsReal[]; inventario: FinanzasInventarioResumen }> {
    const [ordenes, lotes, formulas, resumenPt, movimientosPt, clientes] = await Promise.all([
      ApiService.ordenes.getAll(),
      ApiService.stockMP.getAllLotes(),
      ApiService.formulas.findAll(),
      ApiService.stockPT.getResumen(),
      ApiService.stockPT.getMovimientos(),
      ApiService.clientes.getAll(),
    ]);

    const ventasPt = movimientosPt.filter((movimiento) => movimiento.tipo === 'SALIDA' && Boolean(movimiento.cliente_id));
    const ventasFinancieras = ventasPt
      .map((movimiento) => {
        const monto = Number(movimiento.valor_total ?? 0) > 0
          ? Number(movimiento.valor_total ?? 0)
          : Number(movimiento.cantidad ?? 0) * Number(movimiento.costo_unitario ?? 0);
        if (monto <= 0) return null;
        return {
          fecha: movimiento.created_at,
          tipo: 'INGRESO' as const,
          origen_operativo: 'VENTA_PT',
          descripcion: `Venta ${movimiento.nombre_producto}`,
          monto,
          categoria: 'Ventas PT',
          centro_costo: 'Planta',
          stock_pt_id: movimiento.stock_pt_id ?? null,
        };
      })
      .filter((row): row is {
        fecha: string;
        tipo: 'INGRESO';
        origen_operativo: string;
        descripcion: string;
        monto: number;
        categoria: string;
        centro_costo: string;
        stock_pt_id: string | null;
      } => row !== null);

    const movimientosFinancieros: FlujoCajaRubroDbRow[] = [
      ...ordenes.map((orden) => ({
        fecha: orden.fecha_creacion,
        tipo: 'EGRESO' as const,
        origen_operativo: 'PRODUCCION',
        descripcion: `Producción ${orden.nombre_producto}`,
        monto: Number(orden.costo_total_insumos ?? 0),
        categoria: 'Producción',
        centro_costo: 'Planta',
      })),
      ...ventasFinancieras.map((movimiento) => ({
        fecha: movimiento.fecha,
        tipo: movimiento.tipo,
        origen_operativo: movimiento.origen_operativo,
        descripcion: movimiento.descripcion,
        monto: movimiento.monto,
        categoria: movimiento.categoria,
        centro_costo: movimiento.centro_costo,
      })),
    ];

    const comprobantesVentas: ComprobanteCarteraDbRow[] = ventasPt.flatMap((movimiento) => {
        const monto = Number(movimiento.valor_total ?? 0) > 0
          ? Number(movimiento.valor_total ?? 0)
          : Number(movimiento.cantidad ?? 0) * Number(movimiento.costo_unitario ?? 0);
        if (monto <= 0) return [];
        return [{
          cliente_id: movimiento.cliente_id ?? null,
          tercero: movimiento.cliente_nombre ?? clientes.find((cliente) => cliente.uid === movimiento.cliente_id)?.nombre ?? 'Sin cliente asociado',
          fecha_emision: movimiento.created_at,
          fecha_vencimiento: new Date(new Date(movimiento.created_at).getTime() + 30 * 86400000).toISOString(),
          estado: 'PENDIENTE',
          saldo: monto,
          tipo: 'FACTURA_VENTA',
        }];
      });

    const clientesConVenta = new Set(ventasPt.map((movimiento) => movimiento.cliente_id).filter((value): value is string => Boolean(value)));
    const comprobantesLegacy: ComprobanteCarteraDbRow[] = clientes
      .filter((cliente) => cliente.saldoPendienteArs > 0 && !clientesConVenta.has(cliente.uid))
      .map((cliente, index) => ({
        cliente_id: cliente.uid,
        tercero: cliente.nombre,
        fecha_emision: cliente.ultimaCompra ?? new Date().toISOString(),
        fecha_vencimiento: new Date((cliente.ultimaCompra ? new Date(cliente.ultimaCompra).getTime() : Date.now()) + (index + 1) * 86400000 * 7).toISOString(),
        estado: 'PENDIENTE',
        saldo: cliente.saldoPendienteArs,
        tipo: 'FACTURA_VENTA',
      }));

    const comprobantes = [...comprobantesVentas, ...comprobantesLegacy];

    const costoProduccion = ordenes.reduce((acc, orden) => acc + Number(orden.costo_total_insumos ?? 0), 0);
    const valorStockMp = lotes.reduce(
      (acc, lote) => acc + Number(lote.cantidad_actual ?? 0) * Number(lote.costo_unitario ?? 0),
      0,
    );
    const valorStockPt = resumenPt.reduce((acc, item) => acc + Number(item.valor_monetario ?? 0), 0);
    const valorizacionInventario = valorStockMp + valorStockPt;

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

    const flujoPorMes = new Map<string, { ingresos: number; egresos: number }>();
    movimientosFinancieros.forEach((movimiento) => {
      const mes = `${new Date(movimiento.fecha).getFullYear()}-${String(new Date(movimiento.fecha).getMonth() + 1).padStart(2, '0')}`;
      const current = flujoPorMes.get(mes) ?? { ingresos: 0, egresos: 0 };
      if (movimiento.tipo === 'INGRESO') current.ingresos += Number(movimiento.monto ?? 0);
      if (movimiento.tipo === 'EGRESO') current.egresos += Number(movimiento.monto ?? 0);
      flujoPorMes.set(mes, current);
    });
    const flujoCajaMensual = [...flujoPorMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, value]) => ({
        mes,
        ingresos: Number(value.ingresos.toFixed(2)),
        egresos: Number(value.egresos.toFixed(2)),
        neto: Number((value.ingresos - value.egresos).toFixed(2)),
      }));

    const reportes: FinanzasReportes = {
      ...emptyReportes,
      flujo_caja_mensual: flujoCajaMensual,
      gastos_por_categoria: [
        { categoria: 'Producción', monto: costoProduccion },
        { categoria: 'Merma', monto: perdidaMerma },
      ].filter((row) => row.monto > 0),
      ingresos_por_categoria: [],
      ingresos_pt_por_producto: buildIngresosPtPorProducto(
        movimientosPt,
        ventasFinancieras.map((movimiento) => ({
          stock_pt_id: movimiento.stock_pt_id,
          monto: movimiento.monto,
          fecha: movimiento.fecha,
        })),
      ),
      rentabilidad_por_formula: rentabilidadPorFormula,
      costo_operativo_mensual: costoOperativoMensual,
    };

    const movimientosFinancierosUi: MovimientoFinanciero[] = movimientosFinancieros
      .map((movimiento, index) => ({
        uid: `fml-${index}-${movimiento.tipo.toLowerCase()}-${movimiento.fecha}-${movimiento.descripcion}`.replace(/[^a-zA-Z0-9-]/g, '-'),
        fecha: movimiento.fecha,
        tipo: movimiento.tipo,
        origen_operativo: movimiento.origen_operativo ?? undefined,
        descripcion: movimiento.descripcion,
        monto: Number(movimiento.monto ?? 0),
        categoria: movimiento.categoria ?? undefined,
        centro_costo: movimiento.centro_costo ?? undefined,
        estado: 'CONFIRMADO' as const,
      }))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const tesoreria = buildTesoreriaInsights(
      [
        {
          anio: new Date().getFullYear(),
          mes: new Date().getMonth() + 1,
          monto_presupuestado: costoProduccion,
          categoria: 'Producción',
          centro_costo: 'Planta',
        },
      ],
      movimientosFinancieros,
      clientes,
      comprobantes,
      movimientosPt as unknown as MovimientoStockPT[],
      [
        {
          id: 'chq-demo-1',
          numero: '00001234',
          tipo: 'RECIBIDO',
          tercero: clientes[0]?.nombre ?? 'Cliente demo',
          importe: 125000,
          fecha_emision: new Date().toISOString(),
          fecha_vencimiento: new Date(Date.now() + 7 * 86400000).toISOString(),
          estado: 'PENDIENTE',
          cliente_id: clientes[0]?.uid ?? null,
          cliente_nombre: clientes[0]?.nombre ?? null,
        },
        {
          id: 'chq-demo-2',
          numero: '00004567',
          tipo: 'EMITIDO',
          tercero: 'Proveedor demo',
          importe: 82000,
          fecha_emision: new Date().toISOString(),
          fecha_vencimiento: new Date(Date.now() + 14 * 86400000).toISOString(),
          estado: 'PENDIENTE',
          cliente_id: null,
          cliente_nombre: null,
        },
      ],
      0,
      { rubros: defaultRubros() },
    );

    const ingresoMes = flujoCajaMensual.length > 0 ? flujoCajaMensual[flujoCajaMensual.length - 1].ingresos : 0;
    const egresoMes = flujoCajaMensual.length > 0 ? flujoCajaMensual[flujoCajaMensual.length - 1].egresos : 0;
    const cuentasPorCobrar = tesoreria.carteraClientes.reduce((acc, row) => acc + row.saldo_pendiente, 0);

    const kpis: FinanzasKPIs = {
      saldo_actual: 0,
      ingresos_mes: ingresoMes,
      egresos_mes: egresoMes,
      flujo_neto: ingresoMes - egresoMes,
      margen_operativo: ingresoMes > 0 ? ((ingresoMes - egresoMes) / ingresoMes) * 100 : 0,
      costo_produccion: costoProduccion,
      valorizacion_inventario: valorizacionInventario,
      cuentas_por_pagar: 0,
      cuentas_por_cobrar: cuentasPorCobrar,
      perdida_merma: perdidaMerma,
      valor_stock_mp: valorStockMp,
      valor_stock_pt: valorStockPt,
      valor_inventario_total: valorizacionInventario,
    };

    return {
      kpis,
      reportes,
      tesoreria,
      movimientos: movimientosFinancierosUi,
      costosComparativos: buildCostosFormulaVsReal(formulas, ordenes),
      inventario: {
        valor_stock_mp: valorStockMp,
        valor_stock_pt: valorStockPt,
        valor_inventario_total: valorizacionInventario,
      },
    };
  },
};
