import type { CostosFormulaVsReal, RubroFinancieroCatalogo } from '../types';

const STORAGE_KEY = 'nutribalance_finanzas_rubros_v1';
const CATALOGO_STORAGE_KEY = 'nutribalance_categorias_financieras_v1';

export type RubroFinancieroTipo = 'FIJO' | 'VARIABLE' | 'MIXTO';

export interface RubroFinancieroAdmin {
  id: string;
  nombre: string;
  tipo: RubroFinancieroTipo;
  activo: boolean;
  editable: boolean;
  origen: 'base' | 'personalizado';
  area?: string | null;
  categoria_financiera_id?: string | null;
}

export interface RubroFinancieroFormValues {
  nombre: string;
  tipo: 'INGRESO' | 'EGRESO' | '';
  activo: boolean;
  area?: string;
}

export interface RubroFinancieroFormErrors {
  nombre?: string;
  tipo?: string;
  general?: string;
}

export type PresupuestoEstado = 'OK' | 'Atención' | 'Excedido';
export type IngresoPtSortMode = 'venta_real' | 'variacion' | 'alfabetico';

export interface IngresoPtDashboardRow {
  producto: string;
  cantidad_kg: number;
  importe_total: number;
  clientes_count: number;
  ultima_fecha: string | null;
  variacion_pct: number | null;
  costo_referencial_kg: number | null;
}

export interface MateriaPrimaSimulationInput {
  insumo: string;
  incremento_pct: number;
  volumen_estimado: number;
  costo_unitario_actual: number;
  ingresos_periodo: number;
  egresos_periodo: number;
}

export interface MateriaPrimaSimulationResult {
  insumo: string;
  incremento_pct: number;
  volumen_estimado: number;
  costo_unitario_actual: number;
  costo_unitario_nuevo: number;
  costo_total_actual: number;
  costo_total_nuevo: number;
  impacto_costo: number;
  utilidad_actual: number;
  impacto_utilidad: number;
  utilidad_nueva: number;
  margen_actual_pct: number;
  margen_nuevo_pct: number;
}

const BASE_RUBROS: RubroFinancieroAdmin[] = [
  { id: 'base-materia-prima', nombre: 'Materia prima', tipo: 'VARIABLE', activo: true, editable: true, origen: 'base', area: 'Operaciones' },
  { id: 'base-produccion', nombre: 'Producción', tipo: 'MIXTO', activo: true, editable: true, origen: 'base', area: 'Operaciones' },
  { id: 'base-nomina', nombre: 'Nómina', tipo: 'FIJO', activo: true, editable: true, origen: 'base', area: 'Administración' },
  { id: 'base-servicios', nombre: 'Servicios', tipo: 'FIJO', activo: true, editable: true, origen: 'base', area: 'Administración' },
  { id: 'base-logistica', nombre: 'Logística', tipo: 'VARIABLE', activo: true, editable: true, origen: 'base', area: 'Operaciones' },
  { id: 'base-marketing', nombre: 'Marketing', tipo: 'VARIABLE', activo: true, editable: true, origen: 'base', area: 'Comercial' },
  { id: 'base-otros', nombre: 'Otros', tipo: 'MIXTO', activo: true, editable: true, origen: 'base', area: null },
];

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeKey = (value: string) => cleanText(value).toLowerCase();

const safeWindow = () => (typeof window === 'undefined' ? null : window);

const sanitizeTipo = (value: unknown): RubroFinancieroTipo | null => {
  if (value === 'FIJO' || value === 'VARIABLE' || value === 'MIXTO') {
    return value;
  }
  return null;
};

const sanitizeRubro = (value: unknown, fallback: RubroFinancieroAdmin): RubroFinancieroAdmin => {
  if (!value || typeof value !== 'object') return { ...fallback };
  const candidate = value as Partial<RubroFinancieroAdmin>;
  const nombre = typeof candidate.nombre === 'string' && cleanText(candidate.nombre) ? cleanText(candidate.nombre) : fallback.nombre;
  const tipo = sanitizeTipo(candidate.tipo) ?? fallback.tipo;
  return {
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : fallback.id,
    nombre,
    tipo,
    activo: typeof candidate.activo === 'boolean' ? candidate.activo : fallback.activo,
    editable: typeof candidate.editable === 'boolean' ? candidate.editable : fallback.editable,
    origen: candidate.origen === 'personalizado' ? 'personalizado' : fallback.origen,
    area: typeof candidate.area === 'string' ? cleanText(candidate.area) : fallback.area ?? null,
    categoria_financiera_id: typeof candidate.categoria_financiera_id === 'string' ? candidate.categoria_financiera_id : fallback.categoria_financiera_id ?? null,
  };
};

const withBaseRubros = (rows: RubroFinancieroAdmin[]) => {
  const normalized = new Map(rows.map((row) => [normalizeKey(row.nombre), row]));
  BASE_RUBROS.forEach((base) => {
    if (!normalized.has(normalizeKey(base.nombre))) {
      normalized.set(normalizeKey(base.nombre), { ...base });
    }
  });

  return [...normalized.values()].sort((a, b) => {
    if (a.origen !== b.origen) return a.origen === 'base' ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });
};

export const RUBROS_FINANCIEROS_BASE = BASE_RUBROS.map((row) => ({ ...row }));

export const createDefaultRubrosFinancieros = (): RubroFinancieroAdmin[] => RUBROS_FINANCIEROS_BASE.map((row) => ({ ...row }));

export const loadRubrosFinancieros = (): RubroFinancieroAdmin[] => {
  const win = safeWindow();
  if (!win) return createDefaultRubrosFinancieros();

  try {
    const raw = win.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultRubrosFinancieros();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return createDefaultRubrosFinancieros();
    const fallbacks = createDefaultRubrosFinancieros();
    const sanitized = parsed
      .map((entry, index) => sanitizeRubro(entry, fallbacks[index] ?? fallbacks[0]))
      .filter((row) => row.nombre.length > 0);
    return withBaseRubros(sanitized);
  } catch {
    return createDefaultRubrosFinancieros();
  }
};

export const saveRubrosFinancieros = (rows: RubroFinancieroAdmin[]) => {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
};

export const loadCategoriasFinancierasFallback = (): RubroFinancieroCatalogo[] => {
  const win = safeWindow();
  if (!win) return [];
  try {
    const raw = win.localStorage.getItem(CATALOGO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is RubroFinancieroCatalogo => Boolean(row && typeof row === 'object' && 'id' in row && 'nombre' in row));
  } catch {
    return [];
  }
};

export const saveCategoriasFinancierasFallback = (rows: RubroFinancieroCatalogo[]) => {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(rows));
};

export const normalizeRubroFinancieroInput = (input: RubroFinancieroFormValues): RubroFinancieroFormValues => ({
  nombre: cleanText(input.nombre),
  tipo: input.tipo,
  activo: Boolean(input.activo),
});

export const validateRubroFinancieroInput = (
  input: RubroFinancieroFormValues,
  existingRows: RubroFinancieroAdmin[],
  editingId?: string | null,
): RubroFinancieroFormErrors => {
  const errors: RubroFinancieroFormErrors = {};
  const normalized = normalizeRubroFinancieroInput(input);
  const tipo = normalized.tipo;

  if (!normalized.nombre) {
    errors.nombre = 'El nombre del rubro es obligatorio.';
  } else if (normalized.nombre.length < 2) {
    errors.nombre = 'El nombre del rubro debe tener al menos 2 caracteres.';
  } else if (normalized.nombre.length > 60) {
    errors.nombre = 'El nombre del rubro no puede superar 60 caracteres.';
  }

  if (!tipo) {
    errors.tipo = 'Selecciona un tipo de rubro.';
  }

  const duplicate = existingRows.find((row) => normalizeKey(row.nombre) === normalizeKey(normalized.nombre) && row.id !== editingId);
  if (duplicate) {
    errors.nombre = 'Ya existe un rubro con ese nombre para ese tipo.';
  }

  return errors;
};

export const hasRubroFinancieroErrors = (errors: RubroFinancieroFormErrors) => Object.values(errors).some(Boolean);

export const upsertRubroFinanciero = (
  existingRows: RubroFinancieroAdmin[],
  input: RubroFinancieroFormValues,
  editingId?: string | null,
): RubroFinancieroAdmin[] => {
  const normalized = normalizeRubroFinancieroInput(input);
  const nextRow: RubroFinancieroAdmin = {
    id: editingId ?? `rubro-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    nombre: normalized.nombre,
    tipo: normalized.tipo === 'INGRESO' ? 'FIJO' : 'VARIABLE',
    activo: normalized.activo,
    editable: true,
    origen: 'personalizado',
    area: normalized.area?.trim() || null,
  };

  const validated = validateRubroFinancieroInput(normalized, existingRows, editingId);
  if (hasRubroFinancieroErrors(validated)) {
    throw new Error(Object.values(validated).filter(Boolean).join(' '));
  }

  if (editingId) {
    return existingRows.map((row) => (row.id === editingId ? { ...row, ...nextRow } : row));
  }

  return [...existingRows, nextRow];
};

export const toggleRubroFinanciero = (
  existingRows: RubroFinancieroAdmin[],
  id: string,
  activo: boolean,
): RubroFinancieroAdmin[] => existingRows.map((row) => (row.id === id ? { ...row, activo } : row));

export const getPresupuestoEstado = (presupuesto: number, real: number): PresupuestoEstado => {
  if (presupuesto <= 0 && real <= 0) return 'OK';
  if (presupuesto <= 0 && real > 0) return 'Atención';
  if (real > presupuesto) return 'Excedido';
  if (real >= presupuesto * 0.9) return 'Atención';
  return 'OK';
};

export const sortIngresosPtPorProducto = (
  rows: IngresoPtDashboardRow[],
  sortBy: IngresoPtSortMode,
): IngresoPtDashboardRow[] => {
  const sorted = [...rows];
  if (sortBy === 'venta_real') {
    sorted.sort((a, b) => b.importe_total - a.importe_total || b.cantidad_kg - a.cantidad_kg);
  } else if (sortBy === 'variacion') {
    sorted.sort((a, b) => Math.abs(b.variacion_pct ?? 0) - Math.abs(a.variacion_pct ?? 0) || b.importe_total - a.importe_total);
  } else {
    sorted.sort((a, b) => a.producto.localeCompare(b.producto, 'es', { sensitivity: 'base' }));
  }
  return sorted;
};

export const enrichIngresosPtPorProducto = (
  rows: Array<{
    producto: string;
    cantidad_kg: number;
    importe_total: number;
    clientes_count: number;
    ultima_fecha: string | null;
  }>,
  costosComparativos: CostosFormulaVsReal[],
): IngresoPtDashboardRow[] => {
  const normalizedCostos = new Map(
    costosComparativos.map((row) => [normalizeKey(row.nombre_producto), row]),
  );

  return rows.map((row) => {
    const costo = normalizedCostos.get(normalizeKey(row.producto));
    return {
      ...row,
      variacion_pct: costo?.variacion_pct ?? null,
      costo_referencial_kg: costo?.costo_real_kg ?? costo?.costo_formulado_kg ?? null,
    };
  });
};

export const buildMateriaPrimaSimulation = (input: MateriaPrimaSimulationInput): MateriaPrimaSimulationResult => {
  const round2 = (value: number) => Number(value.toFixed(2));
  const incremento = Number(input.incremento_pct ?? 0);
  const volumen = Math.max(0, Number(input.volumen_estimado ?? 0));
  const costoUnitarioActual = Math.max(0, Number(input.costo_unitario_actual ?? 0));
  const costoUnitarioNuevo = costoUnitarioActual * (1 + incremento / 100);
  const costoTotalActual = costoUnitarioActual * volumen;
  const costoTotalNuevo = costoUnitarioNuevo * volumen;
  const impactoCosto = costoTotalNuevo - costoTotalActual;
  const utilidadActual = Number(input.ingresos_periodo ?? 0) - Number(input.egresos_periodo ?? 0);
  const impactoUtilidad = -impactoCosto;
  const utilidadNueva = utilidadActual + impactoUtilidad;
  const margenActualPct = Number(input.ingresos_periodo ?? 0) > 0 ? (utilidadActual / Number(input.ingresos_periodo ?? 0)) * 100 : 0;
  const margenNuevoPct = Number(input.ingresos_periodo ?? 0) > 0 ? (utilidadNueva / Number(input.ingresos_periodo ?? 0)) * 100 : 0;

  return {
    insumo: input.insumo,
    incremento_pct: round2(incremento),
    volumen_estimado: round2(volumen),
    costo_unitario_actual: round2(costoUnitarioActual),
    costo_unitario_nuevo: round2(costoUnitarioNuevo),
    costo_total_actual: round2(costoTotalActual),
    costo_total_nuevo: round2(costoTotalNuevo),
    impacto_costo: round2(impactoCosto),
    utilidad_actual: round2(utilidadActual),
    impacto_utilidad: round2(impactoUtilidad),
    utilidad_nueva: round2(utilidadNueva),
    margen_actual_pct: round2(margenActualPct),
    margen_nuevo_pct: round2(margenNuevoPct),
  };
};
