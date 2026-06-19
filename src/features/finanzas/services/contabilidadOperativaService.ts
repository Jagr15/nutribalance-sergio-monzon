import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';
import { supabaseClient } from '../../../infrastructure/api/supabase/client';

type MovimientoContablePayload = {
  legacy_uid: string;
  fecha: string;
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
  origen_operativo: string;
  descripcion: string;
  monto: number;
  categoria_id?: string | null;
  centro_costo_id?: string | null;
  comprobante_id?: string | null;
  orden_produccion_id?: string | null;
  stock_lote_mp_id?: string | null;
  stock_pt_id?: string | null;
  estado?: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
  metadata?: Record<string, unknown>;
};

const STORAGE_KEY = 'nutribalance_contabilidad_operativa_v1';

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ');

const ensurePositive = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} debe ser mayor a 0.`);
};

const readMock = (): Array<MovimientoContablePayload & { id?: string }> => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<MovimientoContablePayload & { id?: string }>) : [];
  } catch {
    return [];
  }
};

const writeMock = (rows: Array<MovimientoContablePayload & { id?: string }>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
};

const resolveCategoriaIdByLegacy = async (legacyUid: string) => {
  const { data, error } = await supabaseClient
    .from('categorias_financieras')
    .select('id')
    .eq('legacy_uid', legacyUid)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return data?.id ?? null;
};

const normalizeBase = (payload: MovimientoContablePayload): MovimientoContablePayload => ({
  ...payload,
  descripcion: cleanText(payload.descripcion),
  origen_operativo: cleanText(payload.origen_operativo),
  metadata: payload.metadata ?? {},
  estado: payload.estado ?? 'CONFIRMADO',
  categoria_id: payload.categoria_id ?? null,
  centro_costo_id: payload.centro_costo_id ?? null,
  comprobante_id: payload.comprobante_id ?? null,
  orden_produccion_id: payload.orden_produccion_id ?? null,
  stock_lote_mp_id: payload.stock_lote_mp_id ?? null,
  stock_pt_id: payload.stock_pt_id ?? null,
});

export const contabilidadOperativaService = {
  async ensureMovimiento(payload: MovimientoContablePayload): Promise<void> {
    const normalized = normalizeBase(payload);
    ensurePositive(normalized.monto, 'El monto contable');
    if (!normalized.legacy_uid) throw new Error('El identificador contable es obligatorio.');
    if (!normalized.descripcion) throw new Error('La descripción contable es obligatoria.');
    if (!normalized.origen_operativo) throw new Error('El origen operativo es obligatorio.');

    if (runtimeConfig.mode === 'mock') {
      const rows = readMock();
      const next = { ...normalized };
      const updated = rows.some((row) => row.legacy_uid === next.legacy_uid)
        ? rows.map((row) => (row.legacy_uid === next.legacy_uid ? { ...row, ...next } : row))
        : [...rows, { ...next, id: `fcm-${Date.now()}` }];
      writeMock(updated);
      return;
    }

    const { error } = await supabaseClient.from('flujo_caja_movimientos').upsert({
      legacy_uid: normalized.legacy_uid,
      fecha: normalized.fecha,
      tipo: normalized.tipo,
      origen_operativo: normalized.origen_operativo,
      descripcion: normalized.descripcion,
      monto: normalized.monto,
      categoria_id: normalized.categoria_id ?? undefined,
      centro_costo_id: normalized.centro_costo_id ?? undefined,
      comprobante_id: normalized.comprobante_id ?? undefined,
      orden_produccion_id: normalized.orden_produccion_id ?? undefined,
      stock_lote_mp_id: normalized.stock_lote_mp_id ?? undefined,
      stock_pt_id: normalized.stock_pt_id ?? undefined,
      estado: normalized.estado,
      metadata: normalized.metadata,
    }, { onConflict: 'legacy_uid' });

    if (error) throw error;
  },

  async registrarCompraMateriaPrima(payload: {
    stock_lote_legacy_uid: string;
    fecha: string;
    lote: string;
    insumo: string;
    proveedor: string;
    monto: number;
    remito?: string;
  }): Promise<void> {
    ensurePositive(payload.monto, 'El monto de compra');
    const categoriaId = runtimeConfig.mode === 'supabase'
      ? await resolveCategoriaIdByLegacy('cat-compras')
      : null;

    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-compra-${payload.stock_lote_legacy_uid}`,
      fecha: payload.fecha,
      tipo: 'EGRESO',
      origen_operativo: 'COMPRA_MP',
      descripcion: `Compra MP ${payload.lote} - ${payload.insumo}`,
      monto: payload.monto,
      categoria_id: categoriaId,
      metadata: {
        lote: payload.lote,
        insumo: payload.insumo,
        proveedor: payload.proveedor,
        remito: payload.remito ?? null,
        stock_lote_legacy_uid: payload.stock_lote_legacy_uid,
      },
    });
  },

  async registrarVentaPtDesdeSalida(payload: {
    stock_pt_legacy_uid: string;
    comprobante_legacy_uid: string;
    fecha: string;
    numero: string;
    nombre_producto: string;
    cliente: string;
    monto: number;
    referencia?: string | null;
  }): Promise<void> {
    const categoriaId = runtimeConfig.mode === 'supabase'
      ? await resolveCategoriaIdByLegacy('cat-ventas')
      : null;

    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-venta-${payload.stock_pt_legacy_uid}-${payload.comprobante_legacy_uid}`,
      fecha: payload.fecha,
      tipo: 'INGRESO',
      origen_operativo: 'VENTA_PT',
      descripcion: payload.referencia?.trim() || `Venta PT ${payload.nombre_producto}`,
      monto: payload.monto,
      categoria_id: categoriaId,
      metadata: {
        comprobante_legacy_uid: payload.comprobante_legacy_uid,
        stock_pt_legacy_uid: payload.stock_pt_legacy_uid,
        numero: payload.numero,
        nombre_producto: payload.nombre_producto,
        cliente: payload.cliente,
      },
    });
  },

  async registrarCobranzaComprobante(payload: {
    comprobante_legacy_uid: string;
    fecha: string;
    tercero: string;
    monto: number;
    cliente?: string | null;
    referencia?: string | null;
  }): Promise<void> {
    ensurePositive(payload.monto, 'La cobranza');
    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-cobranza-${payload.comprobante_legacy_uid}`,
      fecha: payload.fecha,
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA',
      descripcion: payload.referencia?.trim() || `Cobranza ${payload.tercero}`,
      monto: payload.monto,
      metadata: {
        comprobante_legacy_uid: payload.comprobante_legacy_uid,
        tercero: payload.tercero,
        cliente: payload.cliente ?? null,
      },
    });
  },

  async registrarPagoComprobante(payload: {
    comprobante_legacy_uid: string;
    fecha: string;
    tercero: string;
    monto: number;
    referencia?: string | null;
  }): Promise<void> {
    ensurePositive(payload.monto, 'El pago');
    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-pago-${payload.comprobante_legacy_uid}`,
      fecha: payload.fecha,
      tipo: 'EGRESO',
      origen_operativo: 'PAGO',
      descripcion: payload.referencia?.trim() || `Pago ${payload.tercero}`,
      monto: payload.monto,
      metadata: {
        comprobante_legacy_uid: payload.comprobante_legacy_uid,
        tercero: payload.tercero,
      },
    });
  },
};
