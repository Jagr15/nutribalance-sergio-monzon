import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';
import { supabaseClient } from '../../../infrastructure/api/supabase/client';

type MovimientoContablePayload = {
  legacy_uid: string;
  fecha: string;
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
  origen_operativo: string;
  origen_modulo?: string;
  origen_id?: string;
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
  fecha_operacion?: string | null;
  fecha_vencimiento?: string | null;
  estado_financiero?: string | null;
  fecha_cobro_pago?: string | null;
};

const STORAGE_KEY = 'nutribalance_contabilidad_operativa_v1';

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ');

const ensurePositive = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} debe ser mayor a 0.`);
};

const ensureRequiredText = (value: string | undefined, label: string) => {
  if (!value?.trim()) throw new Error(`${label} es obligatorio.`);
};

const getStorage = () => {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.localStorage ?? (globalThis as any).window?.localStorage ?? null;
};

const readMock = (): Array<MovimientoContablePayload & { id?: string }> => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<MovimientoContablePayload & { id?: string }>) : [];
  } catch {
    return [];
  }
};

const writeMock = (rows: Array<MovimientoContablePayload & { id?: string }>) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(rows));
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

const resolveComprobanteByLegacy = async (legacyUid: string) => {
  const { data, error } = await supabaseClient
    .from('comprobantes')
    .select('id,estado,saldo,total,fecha_emision,fecha_vencimiento,tipo')
    .eq('legacy_uid', legacyUid)
    .is('deleted_at', null)
    .maybeSingle<{
      id: string;
      estado: string | null;
      saldo: number | null;
      total: number | null;
      fecha_emision: string | null;
      fecha_vencimiento: string | null;
      tipo: string | null;
    }>();

  if (error) throw error;
  return data ?? null;
};

const normalizeBase = (payload: MovimientoContablePayload): MovimientoContablePayload => ({
  ...payload,
  descripcion: cleanText(payload.descripcion),
  origen_operativo: cleanText(payload.origen_operativo),
  metadata: payload.metadata ?? {},
  origen_modulo: payload.origen_modulo?.trim() || undefined,
  origen_id: payload.origen_id?.trim() || undefined,
  estado: payload.estado ?? 'CONFIRMADO',
  categoria_id: payload.categoria_id ?? null,
  centro_costo_id: payload.centro_costo_id ?? null,
  comprobante_id: payload.comprobante_id ?? null,
  orden_produccion_id: payload.orden_produccion_id ?? null,
  stock_lote_mp_id: payload.stock_lote_mp_id ?? null,
  stock_pt_id: payload.stock_pt_id ?? null,
  fecha_operacion: payload.fecha_operacion ?? null,
  fecha_vencimiento: payload.fecha_vencimiento ?? null,
  estado_financiero: payload.estado_financiero ?? null,
  fecha_cobro_pago: payload.fecha_cobro_pago ?? null,
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
      origen_modulo: normalized.origen_modulo ?? undefined,
      origen_id: normalized.origen_id ?? undefined,
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
      fecha_operacion: normalized.fecha_operacion ?? undefined,
      fecha_vencimiento: normalized.fecha_vencimiento ?? undefined,
      estado_financiero: normalized.estado_financiero ?? undefined,
      fecha_cobro_pago: normalized.fecha_cobro_pago ?? undefined,
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
    condicion_pago?: string;
  }): Promise<void> {
    ensureRequiredText(payload.stock_lote_legacy_uid, 'El lote de stock');
    ensureRequiredText(payload.fecha, 'La fecha de compra');
    ensureRequiredText(payload.lote, 'El lote');
    ensureRequiredText(payload.insumo, 'El insumo');
    ensureRequiredText(payload.proveedor, 'El proveedor');
    ensurePositive(payload.monto, 'El monto de compra');
    if (!payload.remito?.trim() && !payload.condicion_pago?.trim()) {
      throw new Error('La compra debe informar remito/documento o condición de pago.');
    }
    const categoriaId = runtimeConfig.mode === 'supabase'
      ? await resolveCategoriaIdByLegacy('cat-compras')
      : null;

    let stockLoteMpId: string | null = null;
    if (runtimeConfig.mode === 'supabase') {
      const { data } = await supabaseClient
        .from('stock_lotes_mp')
        .select('id')
        .eq('legacy_uid', payload.stock_lote_legacy_uid)
        .maybeSingle();
      if (data) {
        stockLoteMpId = data.id;
      }
    }

    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-compra-${payload.stock_lote_legacy_uid}`,
      fecha: payload.fecha,
      tipo: 'EGRESO',
      origen_operativo: 'COMPRA_MP',
      descripcion: `Compra MP ${payload.lote} - ${payload.insumo}`,
      monto: payload.monto,
      categoria_id: categoriaId,
      estado: 'PENDIENTE',
      estado_financiero: 'PENDIENTE_PAGO',
      stock_lote_mp_id: stockLoteMpId,
      metadata: {
        lote: payload.lote,
        insumo: payload.insumo,
        proveedor: payload.proveedor,
        remito: payload.remito ?? null,
        condicion_pago: payload.condicion_pago ?? null,
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
    cliente_id?: string | null;
    monto: number;
    referencia?: string | null;
  }): Promise<void> {
    const categoriaId = runtimeConfig.mode === 'supabase'
      ? await resolveCategoriaIdByLegacy('cat-ventas')
      : null;
    const comprobante = runtimeConfig.mode === 'supabase'
      ? await resolveComprobanteByLegacy(payload.comprobante_legacy_uid)
      : null;
    const saldoComprobante = Number(comprobante?.saldo ?? payload.monto);
    const ventaPendiente = saldoComprobante > 0 && (comprobante?.tipo ?? 'FACTURA_VENTA') === 'FACTURA_VENTA';

    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-venta-${payload.stock_pt_legacy_uid}-${payload.comprobante_legacy_uid}`,
      fecha: comprobante?.fecha_emision ?? payload.fecha,
      tipo: 'INGRESO',
      origen_operativo: 'VENTA_PT',
      descripcion: payload.referencia?.trim() || `Venta PT ${payload.nombre_producto}`,
      monto: payload.monto,
      categoria_id: categoriaId,
      comprobante_id: comprobante?.id ?? null,
      estado: ventaPendiente ? 'PENDIENTE' : 'CONFIRMADO',
      estado_financiero: ventaPendiente ? 'PENDIENTE_COBRO' : 'COBRADO',
      fecha_operacion: comprobante?.fecha_emision ?? payload.fecha,
      fecha_vencimiento: comprobante?.fecha_vencimiento ?? null,
      fecha_cobro_pago: ventaPendiente ? null : payload.fecha,
      metadata: {
        comprobante_legacy_uid: payload.comprobante_legacy_uid,
        stock_pt_legacy_uid: payload.stock_pt_legacy_uid,
        numero: payload.numero,
        nombre_producto: payload.nombre_producto,
        cliente: payload.cliente,
        cliente_id: payload.cliente_id ?? null,
        cliente_legacy_uid: payload.cliente_id ?? null,
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
    const comprobante = runtimeConfig.mode === 'supabase'
      ? await resolveComprobanteByLegacy(payload.comprobante_legacy_uid)
      : null;
    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-cobranza-${payload.comprobante_legacy_uid}`,
      fecha: payload.fecha,
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA',
      descripcion: payload.referencia?.trim() || `Cobranza ${payload.tercero}`,
      monto: payload.monto,
      comprobante_id: comprobante?.id ?? null,
      estado: 'CONFIRMADO',
      estado_financiero: 'COBRADO',
      fecha_operacion: comprobante?.fecha_emision ?? payload.fecha,
      fecha_vencimiento: comprobante?.fecha_vencimiento ?? null,
      fecha_cobro_pago: payload.fecha,
      metadata: {
        comprobante_legacy_uid: payload.comprobante_legacy_uid,
        tercero: payload.tercero,
        cliente: payload.cliente ?? null,
      },
    });
  },

  async sincronizarMovimientoCostos(payload: {
    origen_id: string;
    fecha: string;
    tipo: 'INGRESO' | 'EGRESO';
    descripcion: string;
    monto: number;
    origen_operativo: string;
    categoria_id?: string | null;
    centro_costo_id?: string | null;
    estado?: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
    metadata?: Record<string, unknown>;
    fecha_operacion?: string | null;
    fecha_vencimiento?: string | null;
    estado_financiero?: string | null;
    fecha_cobro_pago?: string | null;
  }): Promise<void> {
    if (!payload.origen_id.trim()) throw new Error('El origen de costos es obligatorio.');
    ensurePositive(payload.monto, 'El monto contable');
    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-costos-${payload.origen_id}`,
      fecha: payload.fecha,
      tipo: payload.tipo,
      origen_operativo: payload.origen_operativo,
      origen_modulo: 'costos',
      origen_id: payload.origen_id,
      descripcion: payload.descripcion,
      monto: payload.monto,
      categoria_id: payload.categoria_id ?? null,
      centro_costo_id: payload.centro_costo_id ?? null,
      estado: payload.estado ?? 'CONFIRMADO',
      metadata: {
        ...payload.metadata,
        origen_modulo: 'costos',
        origen_id: payload.origen_id,
      },
      fecha_operacion: payload.fecha_operacion,
      fecha_vencimiento: payload.fecha_vencimiento,
      estado_financiero: payload.estado_financiero,
      fecha_cobro_pago: payload.fecha_cobro_pago,
    });
  },

  async anularMovimientoCostos(origenId: string): Promise<void> {
    if (!origenId.trim()) throw new Error('El origen de costos es obligatorio.');
    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-costos-${origenId}`,
      fecha: new Date().toISOString(),
      tipo: 'EGRESO',
      origen_operativo: 'COSTOS_ANULACION',
      origen_modulo: 'costos',
      origen_id: origenId,
      descripcion: `Anulación de movimiento de costos ${origenId}`,
      monto: 1,
      estado: 'ANULADO',
      metadata: { origen_modulo: 'costos', origen_id: origenId, accion: 'anulacion' },
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
    const comprobante = runtimeConfig.mode === 'supabase'
      ? await resolveComprobanteByLegacy(payload.comprobante_legacy_uid)
      : null;
    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: `fcm-pago-${payload.comprobante_legacy_uid}`,
      fecha: payload.fecha,
      tipo: 'EGRESO',
      origen_operativo: 'PAGO',
      descripcion: payload.referencia?.trim() || `Pago ${payload.tercero}`,
      monto: payload.monto,
      comprobante_id: comprobante?.id ?? null,
      estado: 'CONFIRMADO',
      estado_financiero: 'PAGADO',
      fecha_operacion: comprobante?.fecha_emision ?? payload.fecha,
      fecha_vencimiento: comprobante?.fecha_vencimiento ?? null,
      fecha_cobro_pago: payload.fecha,
      metadata: {
        comprobante_legacy_uid: payload.comprobante_legacy_uid,
        tercero: payload.tercero,
      },
    });
  },

  async confirmarMovimiento(legacyUid: string): Promise<void> {
    if (runtimeConfig.mode === 'mock') {
      const rows = readMock();
      const updated = rows.map((row) => {
        if (row.legacy_uid === legacyUid) {
          return {
            ...row,
            estado: 'CONFIRMADO' as const,
            estado_financiero: row.tipo === 'INGRESO' ? 'COBRADO' : 'PAGADO',
            fecha_cobro_pago: new Date().toISOString().split('T')[0],
          };
        }
        return row;
      });
      writeMock(updated);
      return;
    }

    const { data: currentMov, error: getErr } = await supabaseClient
      .from('flujo_caja_movimientos')
      .select('tipo')
      .eq('legacy_uid', legacyUid)
      .maybeSingle();

    if (getErr) throw getErr;

    const nextEstadoFinanciero = currentMov?.tipo === 'INGRESO' ? 'COBRADO' : 'PAGADO';

    const { error } = await supabaseClient
      .from('flujo_caja_movimientos')
      .update({
        estado: 'CONFIRMADO',
        estado_financiero: nextEstadoFinanciero,
        fecha_cobro_pago: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('legacy_uid', legacyUid);

    if (error) throw error;
  },

  async updateMovimiento(legacyUid: string, payload: {
    descripcion: string;
    monto: number;
    fecha_operacion: string;
    fecha_vencimiento: string;
    estado_financiero: string;
    categoria_id?: string | null;
  }): Promise<void> {
    let dbEstado: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO' = 'PENDIENTE';
    if (['COBRADO', 'PAGADO'].includes(payload.estado_financiero)) {
      dbEstado = 'CONFIRMADO';
    } else if (payload.estado_financiero === 'CANCELADO') {
      dbEstado = 'ANULADO';
    }

    if (runtimeConfig.mode === 'mock') {
      const rows = readMock();
      const updated = rows.map((row) => {
        if (row.legacy_uid === legacyUid) {
          return {
            ...row,
            descripcion: payload.descripcion,
            monto: payload.monto,
            fecha_operacion: payload.fecha_operacion,
            fecha_vencimiento: payload.fecha_vencimiento,
            estado_financiero: payload.estado_financiero,
            categoria_id: payload.categoria_id ?? null,
            estado: dbEstado,
          };
        }
        return row;
      });
      writeMock(updated);
      return;
    }

    const { error } = await supabaseClient
      .from('flujo_caja_movimientos')
      .update({
        descripcion: payload.descripcion,
        monto: payload.monto,
        fecha_operacion: payload.fecha_operacion,
        fecha_vencimiento: payload.fecha_vencimiento,
        estado_financiero: payload.estado_financiero,
        categoria_id: payload.categoria_id ?? null,
        estado: dbEstado,
        updated_at: new Date().toISOString(),
      })
      .eq('legacy_uid', legacyUid);

    if (error) throw error;
  },

  async deleteMovimiento(legacyUid: string): Promise<void> {
    if (runtimeConfig.mode === 'mock') {
      const rows = readMock();
      const current = rows.find(r => r.legacy_uid === legacyUid);
      if (!current) return;
      if (current.estado === 'CONFIRMADO') {
        throw new Error('No se puede eliminar un movimiento confirmado.');
      }

      const { getMockStockLocal } = await import('../../../infrastructure/api/mock/services/mockMateriaPrimaService');
      const { getMockStockPTRows } = await import('../../../infrastructure/api/mock/services/mockStockPTService');

      if (current.stock_lote_mp_id || current.metadata?.stock_lote_legacy_uid) {
        const lotId = current.stock_lote_mp_id || current.metadata?.stock_lote_legacy_uid;
        const lot = getMockStockLocal().find(l => l.uid === lotId);
        if (lot && !(lot as any).deletedAt) {
          throw new Error('No se puede eliminar este movimiento porque está vinculado a una transacción operativa de stock o producción activa.');
        }
      }
      if (current.stock_pt_id) {
        const pt = getMockStockPTRows().find(p => p.uid === current.stock_pt_id || p.id === current.stock_pt_id);
        if (pt && !(pt as any).deletedAt) {
          throw new Error('No se puede eliminar este movimiento porque está vinculado a una transacción operativa de stock o producción activa.');
        }
      }

      const updated = rows.map((row) => {
        if (row.legacy_uid === legacyUid) {
          return { ...row, deletedAt: new Date().toISOString() };
        }
        return row;
      });
      writeMock(updated);
      return;
    }

    const { data: current, error: getErr } = await supabaseClient
      .from('flujo_caja_movimientos')
      .select('estado, stock_lote_mp_id, stock_pt_id, comprobante_id')
      .eq('legacy_uid', legacyUid)
      .maybeSingle();

    if (getErr) throw getErr;
    if (!current) throw new Error('Movimiento no encontrado');

    if (current.estado === 'CONFIRMADO') {
      throw new Error('No se puede eliminar un movimiento confirmado.');
    }

    // Check if linked to non-deleted critical operations
    if (current.stock_lote_mp_id) {
      const { count: lotCount, error: lotErr } = await supabaseClient
        .from('stock_lotes_mp')
        .select('id', { count: 'exact', head: true })
        .eq('id', current.stock_lote_mp_id)
        .is('deleted_at', null);
      if (lotErr) throw lotErr;
      if ((lotCount ?? 0) > 0) {
        throw new Error('No se puede eliminar este movimiento porque está vinculado a una transacción operativa de stock o producción activa.');
      }
    }

    if (current.stock_pt_id) {
      const { count: ptCount, error: ptErr } = await supabaseClient
        .from('stock_pt')
        .select('id', { count: 'exact', head: true })
        .eq('id', current.stock_pt_id)
        .is('deleted_at', null);
      if (ptErr) throw ptErr;
      if ((ptCount ?? 0) > 0) {
        throw new Error('No se puede eliminar este movimiento porque está vinculado a una transacción operativa de stock o producción activa.');
      }
    }

    const { error } = await supabaseClient
      .from('flujo_caja_movimientos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('legacy_uid', legacyUid);

    if (error) throw error;
  },

  getMovimientosMock(): Array<MovimientoContablePayload & { id?: string }> {
    return readMock().filter((m: any) => !m.deletedAt && !m.deleted_at);
  },

  eliminarMovimientosPendientesDeLoteMock(loteLegacyUid: string): void {
    if (runtimeConfig.mode !== 'mock') return;
    const rows = readMock();
    const updated = rows.map((row) => {
      const meta = row.metadata || {};
      if (
        (meta.stock_lote_legacy_uid === loteLegacyUid || row.legacy_uid === `fcm-compra-${loteLegacyUid}`) &&
        row.estado === 'PENDIENTE'
      ) {
        return { ...row, deletedAt: new Date().toISOString() };
      }
      return row;
    });
    writeMock(updated);
  },
};
