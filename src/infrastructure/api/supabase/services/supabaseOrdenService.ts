import type { Ingrediente } from '../../../../features/formulas/types';
import { planFifoConsumption, type StockLoteForFlow } from '../../../../features/ordenes/utils/productionFlow';
import type { DetalleInsumoLote, OrdenProduccion } from '../../../../features/ordenes/types';
import { supabaseClient } from '../client';

interface OrdenRow {
  id: string;
  legacy_uid: string | null;
  lote: string;
  formula_id: string | null;
  id_formula_legacy: string | null;
  nombre_producto: string;
  version_formula: number;
  cantidad_objetivo: number;
  cantidad_real: number | null;
  merma_manual: number | null;
  silo_id: string | null;
  id_silo_legacy: string | null;
  destino_silo: string | null;
  estado: string;
  fecha_creacion: string;
  usuario_responsable: string;
  usuario_id: string | null;
  costo_total_insumos: number;
}

interface OrdenConsumoRow {
  orden_id: string;
  id_lote_legacy: string | null;
  id_insumo_legacy: string | null;
  nombre_insumo: string;
  cantidad_usada: number;
  tipo_unidad: string;
  costo_unitario: number;
  costo_total: number;
}

interface FormulaIngredienteRow {
  porcentaje: number;
  nombre_insumo: string;
  insumos: { legacy_uid: string | null } | null;
}
interface StockLotesForFlowRow {
  id: string;
  legacy_uid: string | null;
  lote: string;
  fecha_ingreso: string;
  cantidad_actual: number;
  cantidad_comprometida: number | null;
  costo_unitario: number;
  insumos: Array<{ legacy_uid: string | null; nombre: string }> | null;
}

const toDetalle = (row: OrdenConsumoRow): DetalleInsumoLote => ({
  id_lote: row.id_lote_legacy ?? '',
  id_insumo: row.id_insumo_legacy ?? '',
  nombre_insumo: row.nombre_insumo,
  cantidad_usada: Number(row.cantidad_usada),
  tipo_unidad: row.tipo_unidad as DetalleInsumoLote['tipo_unidad'],
  costo_unitario: Number(row.costo_unitario),
  costo_total: Number(row.costo_total),
});

const buildDetalleMap = (rows: OrdenConsumoRow[]) => {
  const map = new Map<string, DetalleInsumoLote[]>();
  rows.forEach((row) => {
    const current = map.get(row.orden_id) ?? [];
    current.push(toDetalle(row));
    map.set(row.orden_id, current);
  });
  return map;
};

const toOrden = (row: OrdenRow, detalle: DetalleInsumoLote[]): OrdenProduccion => ({
  id: row.legacy_uid ?? crypto.randomUUID(),
  lote: row.lote,
  id_formula: row.id_formula_legacy ?? '',
  nombre_producto: row.nombre_producto,
  version_formula: Number(row.version_formula),
  cantidad_objetivo: Number(row.cantidad_objetivo),
  cantidad_real: row.cantidad_real === null ? undefined : Number(row.cantidad_real),
  merma_manual: row.merma_manual === null ? undefined : Number(row.merma_manual),
  estado: row.estado as OrdenProduccion['estado'],
  fecha_creacion: row.fecha_creacion,
  usuario_responsable: row.usuario_responsable,
  id_silo: row.id_silo_legacy,
  destino_silo: row.destino_silo,
  detalle_insumos: detalle,
  costo_total_insumos: Number(row.costo_total_insumos),
});

const buildDetalleRows = (
  detallePlanificado: DetalleInsumoLote[],
  stockMap: Awaited<ReturnType<typeof getStockMapByLegacyLote>>,
  insumoMap: Awaited<ReturnType<typeof getInsumoIdMapByLegacy>>
) => detallePlanificado.map((item) => {
  const stockId = stockMap.byLegacy.get(item.id_lote) ?? stockMap.byLoteName.get(item.id_lote) ?? null;
  const insumoId = insumoMap.get(item.id_insumo) ?? null;

  return {
    lote_id: stockId,
    id_lote_legacy: item.id_lote,
    insumo_id: insumoId,
    id_insumo_legacy: item.id_insumo,
    nombre_insumo: item.nombre_insumo,
    cantidad_usada: item.cantidad_usada,
    tipo_unidad: item.tipo_unidad,
    costo_unitario: item.costo_unitario,
    costo_total: item.costo_total,
  };
});

const parseInputDetalle = (detalle: DetalleInsumoLote[] | undefined) => {
  if (detalle === undefined) return undefined;
  if (detalle.length === 0) {
    throw new Error('La orden no tiene consumo planificado.');
  }
  return detalle;
};

const getCurrentDetalle = async (ordenId: string) => {
  const detalleMap = await loadDetalleForOrdenIds([ordenId]);
  return detalleMap.get(ordenId) ?? [];
};

const adjustStockForReleasedDetail = (
  lotes: StockLoteForFlow[],
  detalleActual: DetalleInsumoLote[]
) => {
  const clone = lotes.map((lote) => ({ ...lote }));
  detalleActual.forEach((item) => {
    const index = clone.findIndex((lote) => lote.legacy_uid === item.id_lote || lote.lote === item.id_lote);
    if (index === -1) return;
    clone[index] = {
      ...clone[index],
      cantidad_comprometida: Math.max(0, (clone[index].cantidad_comprometida ?? 0) - item.cantidad_usada),
    };
  });
  return clone;
};

const getFormulaIdByLegacy = async (legacyUid: string): Promise<string | null> => {
  const { data, error } = await supabaseClient
    .from('formulas')
    .select('id')
    .eq('legacy_uid', legacyUid)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return data?.id ?? null;
};

const getFormulaLegacyById = async (formulaId: string): Promise<string | null> => {
  const { data, error } = await supabaseClient
    .from('formulas')
    .select('legacy_uid')
    .eq('id', formulaId)
    .is('deleted_at', null)
    .maybeSingle<{ legacy_uid: string | null }>();

  if (error) throw error;
  return data?.legacy_uid ?? null;
};

const getSiloIdByLegacy = async (legacyUid: string | null): Promise<string | null> => {
  if (!legacyUid) return null;

  const { data, error } = await supabaseClient
    .from('silos')
    .select('id')
    .eq('legacy_uid', legacyUid)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return data?.id ?? null;
};

const getUsuarioIdByName = async (nombre: string): Promise<string | null> => {
  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('id')
    .eq('nombre', nombre)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return data?.id ?? null;
};

const loadDetalleForOrdenIds = async (ordenIds: string[]): Promise<Map<string, DetalleInsumoLote[]>> => {
  if (ordenIds.length === 0) return new Map<string, DetalleInsumoLote[]>();

  const { data, error } = await supabaseClient
    .from('orden_consumo_lotes')
    .select('orden_id,id_lote_legacy,id_insumo_legacy,nombre_insumo,cantidad_usada,tipo_unidad,costo_unitario,costo_total')
    .in('orden_id', ordenIds);

  if (error) throw error;
  return buildDetalleMap((data ?? []) as unknown as OrdenConsumoRow[]);
};

const getStockMapByLegacyLote = async () => {
  const { data, error } = await supabaseClient
    .from('stock_lotes_mp')
    .select('id,legacy_uid,lote')
    .is('deleted_at', null);

  if (error) throw error;

  const byLegacy = new Map<string, string>();
  const byLoteName = new Map<string, string>();

  (data ?? []).forEach((row) => {
    if (row.legacy_uid) byLegacy.set(row.legacy_uid, row.id);
    if (row.lote) byLoteName.set(row.lote, row.id);
  });

  return { byLegacy, byLoteName };
};

const getInsumoIdMapByLegacy = async () => {
  const { data, error } = await supabaseClient
    .from('insumos')
    .select('id,legacy_uid')
    .is('deleted_at', null);

  if (error) throw error;

  const map = new Map<string, string>();
  (data ?? []).forEach((row) => {
    if (row.legacy_uid) map.set(row.legacy_uid, row.id);
  });
  return map;
};

const getFormulaIngredientes = async (formulaId: string): Promise<Ingrediente[]> => {
  const { data, error } = await supabaseClient
    .from('formula_ingredientes')
    .select('porcentaje,nombre_insumo,insumos(legacy_uid)')
    .eq('formula_id', formulaId)
    .order('orden', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as FormulaIngredienteRow[]).map((row) => ({
    id_insumo: row.insumos?.legacy_uid ?? '',
    nombre_insumo: row.nombre_insumo,
    porcentaje: Number(row.porcentaje),
  }));
};

const getStockLotesForFlow = async (): Promise<StockLoteForFlow[]> => {
  const { data, error } = await supabaseClient
    .from('stock_lotes_mp')
    .select('id,legacy_uid,lote,fecha_ingreso,cantidad_actual,cantidad_comprometida,costo_unitario,insumos(legacy_uid,nombre)')
    .is('deleted_at', null);

  if (error) throw error;

  return ((data ?? []) as unknown as StockLotesForFlowRow[]).map((row) => {
    const insumo = row.insumos?.[0];
    return {
      id: row.id,
      legacy_uid: row.legacy_uid,
      lote: row.lote,
      insumo_legacy_uid: insumo?.legacy_uid ?? '',
      insumo_nombre: insumo?.nombre ?? 'Insumo',
      fecha_ingreso: row.fecha_ingreso,
      cantidad_actual: Number(row.cantidad_actual),
      cantidad_comprometida: Number(row.cantidad_comprometida ?? 0),
      costo_unitario: Number(row.costo_unitario),
    };
  });
};

const getOrdenByLegacy = async (legacyUid: string) => {
  const { data, error } = await supabaseClient
    .from('ordenes_produccion')
    .select('id,legacy_uid,lote,formula_id,id_formula_legacy,nombre_producto,version_formula,cantidad_objetivo,cantidad_real,merma_manual,silo_id,id_silo_legacy,destino_silo,estado,fecha_creacion,usuario_responsable,usuario_id,costo_total_insumos')
    .eq('legacy_uid', legacyUid)
    .is('deleted_at', null)
    .single<OrdenRow>();

  if (error) throw error;
  return data;
};

export const supabaseOrdenService = {
  async getAll(): Promise<OrdenProduccion[]> {
    const { data, error } = await supabaseClient
      .from('ordenes_produccion')
      .select('id,legacy_uid,lote,id_formula_legacy,nombre_producto,version_formula,cantidad_objetivo,cantidad_real,merma_manual,id_silo_legacy,destino_silo,estado,fecha_creacion,usuario_responsable,costo_total_insumos')
      .is('deleted_at', null)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as unknown as OrdenRow[];
    const detalleMap = await loadDetalleForOrdenIds(rows.map((row) => row.id));

    return rows.map((row) => toOrden(row, detalleMap.get(row.id) ?? []));
  },

  async create(payload: Omit<OrdenProduccion, 'id'>): Promise<OrdenProduccion> {
    const [formulaId, siloId, usuarioId] = await Promise.all([
      getFormulaIdByLegacy(payload.id_formula),
      getSiloIdByLegacy(payload.id_silo),
      getUsuarioIdByName(payload.usuario_responsable),
    ]);

    if (!formulaId) throw new Error('La fórmula seleccionada no existe.');

    const formulaIngredientes = await getFormulaIngredientes(formulaId);
    if (formulaIngredientes.length === 0) {
      throw new Error('La fórmula no tiene ingredientes configurados.');
    }

    const lotes = await getStockLotesForFlow();
    const fifoPlan = planFifoConsumption(payload.cantidad_objetivo, formulaIngredientes, lotes);
    if (!fifoPlan.stockSuficiente) {
      throw new Error(`Stock insuficiente para: ${fifoPlan.faltantes.join(', ')}`);
    }

    const detallePlanificado = payload.detalle_insumos.length > 0 ? payload.detalle_insumos : fifoPlan.detalle;

    if (detallePlanificado.length === 0) {
      throw new Error('La orden no tiene consumo planificado.');
    }

    const [stockMap, insumoMap] = await Promise.all([getStockMapByLegacyLote(), getInsumoIdMapByLegacy()]);
    const rows = buildDetalleRows(detallePlanificado, stockMap, insumoMap);

    const { data, error } = await supabaseClient.rpc('crear_orden_produccion_con_reserva', {
      p_legacy_uid: '',
      p_lote: '',
      p_formula_id: formulaId,
      p_id_formula_legacy: payload.id_formula,
      p_nombre_producto: payload.nombre_producto,
      p_version_formula: payload.version_formula,
      p_cantidad_objetivo: payload.cantidad_objetivo,
      p_cantidad_real: payload.cantidad_real ?? null,
      p_merma_manual: payload.merma_manual ?? null,
      p_silo_id: siloId,
      p_id_silo_legacy: payload.id_silo,
      p_destino_silo: payload.destino_silo,
      p_estado: payload.estado,
      p_fecha_creacion: payload.fecha_creacion,
      p_usuario_responsable: payload.usuario_responsable,
      p_usuario_id: usuarioId,
      p_costo_total_insumos: payload.costo_total_insumos || fifoPlan.costoTotal,
      p_detalle: rows,
    });

    if (error) throw error;

    const created = Array.isArray(data) ? data[0] : data;
    if (!created) throw new Error('No se pudo recuperar la orden creada.');

    return toOrden(created as unknown as OrdenRow, detallePlanificado);
  },

  async update(id: string, payload: Partial<OrdenProduccion>): Promise<OrdenProduccion> {
    const extra = payload as Partial<OrdenProduccion> & { lote_salida?: string; merma?: number };

    const current = await getOrdenByLegacy(id);
    const detalleActual = await getCurrentDetalle(current.id);

    // Inicio real de producción
    if (payload.estado === 'EN PROCESO') {
      if (current.estado !== 'PENDIENTE') {
        throw new Error('Solo se puede iniciar una orden en estado PENDIENTE.');
      }

      const { data, error } = await supabaseClient
        .from('ordenes_produccion')
        .update({ estado: 'EN PROCESO' })
        .eq('legacy_uid', id)
        .select('id,legacy_uid,lote,id_formula_legacy,nombre_producto,version_formula,cantidad_objetivo,cantidad_real,merma_manual,id_silo_legacy,destino_silo,estado,fecha_creacion,usuario_responsable,costo_total_insumos')
        .single();

      if (error) throw error;

      await supabaseClient.from('trazabilidad_eventos').insert({
        legacy_uid: `trz-${Math.random().toString(36).slice(2, 10)}`,
        orden_id: current.id,
        tipo: 'PRODUCCION_INICIO',
        referencia: `Inicio de producción ${id}`,
        payload: { estado_previo: current.estado, estado_nuevo: 'EN PROCESO' },
      });

      return toOrden(data as unknown as OrdenRow, detalleActual);
    }

    // Finalización real de producción
    if (payload.estado === 'FINALIZADO') {
      if (current.estado === 'FINALIZADO') throw new Error('La orden ya se encuentra finalizada.');
      if (current.estado === 'ANULADO') throw new Error('No se puede finalizar una orden anulada.');
      if (current.estado !== 'EN PROCESO') throw new Error('Solo se puede finalizar una orden EN PROCESO.');

      if (!extra.destino_silo || extra.destino_silo.trim().length === 0) {
        throw new Error('Debe indicar el silo de destino.');
      }
      if (!extra.lote_salida || extra.lote_salida.trim().length === 0) {
        throw new Error('Debe indicar el lote de salida de producto terminado.');
      }
      if (!extra.cantidad_real || extra.cantidad_real <= 0) {
        throw new Error('La cantidad real debe ser mayor a cero.');
      }
      if (detalleActual.length === 0) {
        throw new Error('La orden no tiene consumo planificado.');
      }

      const { data: updated, error: finalizeError } = await supabaseClient.rpc('finalizar_orden_produccion', {
        p_orden_id: current.id,
        p_cantidad_real: extra.cantidad_real,
        p_merma_manual: extra.merma ?? payload.merma_manual ?? null,
        p_destino_silo: extra.destino_silo,
        p_lote_salida: extra.lote_salida,
      });

      if (finalizeError) throw finalizeError;

      const updatedRow = Array.isArray(updated) ? updated[0] : updated;
      if (!updatedRow) throw new Error('No se pudo recuperar la orden finalizada.');
      return toOrden(updatedRow as unknown as OrdenRow, detalleActual);
    }

    const requiresReservationRebuild =
      typeof payload.id_formula !== 'undefined' ||
      typeof payload.cantidad_objetivo !== 'undefined' ||
      typeof payload.detalle_insumos !== 'undefined';

    if (requiresReservationRebuild) {
      if (current.estado !== 'PENDIENTE' && current.estado !== 'EN PROCESO') {
        throw new Error('Solo se puede editar una orden PENDIENTE o EN PROCESO.');
      }

      const [stockMap, insumoMap] = await Promise.all([getStockMapByLegacyLote(), getInsumoIdMapByLegacy()]);

      const targetFormulaLegacy = payload.id_formula ?? current.id_formula_legacy ?? '';
      const targetFormulaId = payload.id_formula
        ? await getFormulaIdByLegacy(payload.id_formula)
        : current.formula_id;
      const formulaLegacyFallback = targetFormulaId ? await getFormulaLegacyById(targetFormulaId) : null;

      if (!targetFormulaId) {
        throw new Error('La fórmula seleccionada no existe.');
      }

      const targetCantidad = payload.cantidad_objetivo ?? current.cantidad_objetivo;
      let detallePlanificado: DetalleInsumoLote[];

      if (payload.detalle_insumos !== undefined) {
        detallePlanificado = parseInputDetalle(payload.detalle_insumos) ?? [];
      } else {
        const formulaIngredientes = await getFormulaIngredientes(targetFormulaId);
        if (formulaIngredientes.length === 0) {
          throw new Error('La fórmula no tiene ingredientes configurados.');
        }

        const lotesBase = adjustStockForReleasedDetail(
          await getStockLotesForFlow(),
          detalleActual
        );

        const fifoPlan = planFifoConsumption(targetCantidad, formulaIngredientes, lotesBase);
        if (!fifoPlan.stockSuficiente) {
          throw new Error(`Stock insuficiente para: ${fifoPlan.faltantes.join(', ')}`);
        }
        detallePlanificado = fifoPlan.detalle;
      }

      const rows = buildDetalleRows(detallePlanificado, stockMap, insumoMap);
      const costoTotal = payload.costo_total_insumos ?? detallePlanificado.reduce((acc, item) => acc + item.costo_total, 0);

      const { data: updated, error: updateError } = await supabaseClient.rpc('actualizar_orden_produccion_con_reserva', {
        p_orden_id: current.id,
        p_legacy_uid: payload.lote ?? current.legacy_uid ?? current.lote,
        p_lote: payload.lote ?? current.lote,
        p_formula_id: targetFormulaId,
        p_id_formula_legacy: targetFormulaLegacy || formulaLegacyFallback || current.id_formula_legacy || '',
        p_nombre_producto: payload.nombre_producto ?? current.nombre_producto,
        p_version_formula: payload.version_formula ?? current.version_formula,
        p_cantidad_objetivo: targetCantidad,
        p_cantidad_real: payload.cantidad_real ?? current.cantidad_real ?? null,
        p_merma_manual: payload.merma_manual ?? current.merma_manual ?? null,
        p_silo_id: typeof payload.id_silo !== 'undefined'
          ? await getSiloIdByLegacy(payload.id_silo)
          : current.silo_id,
        p_id_silo_legacy: typeof payload.id_silo !== 'undefined' ? payload.id_silo : current.id_silo_legacy,
        p_destino_silo: payload.destino_silo ?? current.destino_silo,
        p_fecha_creacion: payload.fecha_creacion ?? current.fecha_creacion,
        p_usuario_responsable: payload.usuario_responsable ?? current.usuario_responsable,
        p_usuario_id: payload.usuario_responsable
          ? await getUsuarioIdByName(payload.usuario_responsable)
          : current.usuario_id,
        p_costo_total_insumos: costoTotal,
        p_detalle: rows,
      });

      if (updateError) throw updateError;

      const updatedRow = Array.isArray(updated) ? updated[0] : updated;
      if (!updatedRow) throw new Error('No se pudo recuperar la orden actualizada.');
      return toOrden(updatedRow as unknown as OrdenRow, detallePlanificado);
    }

    // Update genérico (sin workflow)
    const [formulaId, siloId, usuarioId] = await Promise.all([
      payload.id_formula ? getFormulaIdByLegacy(payload.id_formula) : Promise.resolve(undefined),
      typeof payload.id_silo !== 'undefined' ? getSiloIdByLegacy(payload.id_silo) : Promise.resolve(undefined),
      payload.usuario_responsable ? getUsuarioIdByName(payload.usuario_responsable) : Promise.resolve(undefined),
    ]);

    const rawPayload = {
      lote: payload.lote,
      formula_id: formulaId,
      id_formula_legacy: payload.id_formula,
      nombre_producto: payload.nombre_producto,
      version_formula: payload.version_formula,
      cantidad_objetivo: payload.cantidad_objetivo,
      cantidad_real: payload.cantidad_real,
      merma_manual: payload.merma_manual,
      silo_id: siloId,
      id_silo_legacy: payload.id_silo,
      destino_silo: payload.destino_silo,
      estado: payload.estado,
      fecha_creacion: payload.fecha_creacion,
      usuario_responsable: payload.usuario_responsable,
      usuario_id: usuarioId,
      costo_total_insumos: payload.costo_total_insumos,
    };
    const cleanPayload = Object.fromEntries(
      Object.entries(rawPayload).filter(([, value]) => value !== undefined)
    );

    const { data, error } = await supabaseClient
      .from('ordenes_produccion')
      .update(cleanPayload)
      .eq('legacy_uid', id)
      .select('id,legacy_uid,lote,id_formula_legacy,nombre_producto,version_formula,cantidad_objetivo,cantidad_real,merma_manual,id_silo_legacy,destino_silo,estado,fecha_creacion,usuario_responsable,costo_total_insumos')
      .single();

    if (error) throw error;

    if (payload.detalle_insumos) {
      const [stockMap, insumoMap] = await Promise.all([getStockMapByLegacyLote(), getInsumoIdMapByLegacy()]);

      const { error: deleteError } = await supabaseClient.from('orden_consumo_lotes').delete().eq('orden_id', current.id);
      if (deleteError) throw deleteError;

      if (payload.detalle_insumos.length > 0) {
        const rows = payload.detalle_insumos.map((item) => {
          const stockId = stockMap.byLegacy.get(item.id_lote) ?? stockMap.byLoteName.get(item.id_lote) ?? null;
          const insumoId = insumoMap.get(item.id_insumo) ?? null;

          return {
            orden_id: current.id,
            lote_id: stockId,
            id_lote_legacy: item.id_lote,
            insumo_id: insumoId,
            id_insumo_legacy: item.id_insumo,
            nombre_insumo: item.nombre_insumo,
            cantidad_usada: item.cantidad_usada,
            tipo_unidad: item.tipo_unidad,
            costo_unitario: item.costo_unitario,
            costo_total: item.costo_total,
          };
        });

        const { error: insertError } = await supabaseClient.from('orden_consumo_lotes').insert(rows);
        if (insertError) throw insertError;
      }
    }

    const updated = data as unknown as OrdenRow;
    const detalle = payload.detalle_insumos ?? (await loadDetalleForOrdenIds([updated.id])).get(updated.id) ?? [];
    return toOrden(updated, detalle);
  },

  async delete(id: string): Promise<boolean> {
    const current = await getOrdenByLegacy(id);
    if (current.estado === 'FINALIZADO') {
      throw new Error('No se puede cancelar una orden finalizada.');
    }

    const { error: releaseError } = await supabaseClient.rpc('anular_orden_produccion_con_liberacion', {
      p_orden_id: current.id,
    });
    if (releaseError) throw releaseError;
    return true;
  },
};
