import type { MovimientoMPAuditoria, TrazabilidadPorOP } from '../../../../features/trazabilidad/types';
import { mockOrdenService } from './mockOrdenService';
import { mockStockPTService } from './mockStockPTService';
import { getMockStockSnapshot } from './mockMateriaPrimaService';
import insumosData from '../data/insumos.json';

type OrderLike = Awaited<ReturnType<typeof mockOrdenService.getAll>>[number];
type PtMovementLike = Awaited<ReturnType<typeof mockStockPTService.getMovimientos>>[number];
type InsumoLike = (typeof insumosData)[number];

const toIso = (value: Date | string | undefined | null) => {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
};

const insumoByUid = new Map<string, InsumoLike>((insumosData as InsumoLike[]).map((item) => [item.uid, item]));

const mapOrderByLot = (orders: OrderLike[]) => {
  const byLot = new Map<string, OrderLike>();
  orders.forEach((order) => {
    byLot.set(order.lote, order);
    order.detalle_insumos?.forEach((detalle) => {
      if (detalle.id_lote) byLot.set(detalle.id_lote, order);
    });
  });
  return byLot;
};

const buildMovimientos = async (): Promise<MovimientoMPAuditoria[]> => {
  const [orders, snapshot] = await Promise.all([
    mockOrdenService.getAll(),
    Promise.resolve(getMockStockSnapshot()),
  ]);
  const orderByLot = mapOrderByLot(orders);
  const movimientos = snapshot.movimientosDB.length > 0
    ? snapshot.movimientosDB
    : orders.flatMap((order) => {
        if (order.estado !== 'FINALIZADO') return [];
        return (order.detalle_insumos ?? []).map((detalle, index) => ({
          uid: `mov-aud-${order.id}-${index}`,
          fecha: new Date(order.fecha_creacion),
          id_usuario: order.usuario_responsable ?? '',
          tipo: 'SALIDA' as const,
          origen: 'PRODUCCION' as const,
          id_entidad: detalle.id_insumo,
          nombre_entidad: detalle.nombre_insumo ?? detalle.id_insumo,
          cantidad: -Math.abs(Number(detalle.cantidad_usada ?? 0)),
          lote_afectado: detalle.id_lote,
          observaciones: `Consumo por OP ${order.lote}`,
        }));
      });

  return movimientos
    .map((mov) => {
      const order = orderByLot.get(mov.lote_afectado);
      const stock = snapshot.stockDB.find((item) => item.lote === mov.lote_afectado || item.uid === mov.lote_afectado);
      const insumo = stock ? insumoByUid.get(stock.id_insumo) : undefined;
      return {
        fecha: toIso(mov.fecha),
        tipo_movimiento: mov.tipo,
        insumo: insumo?.nombre ?? stock?.id_insumo ?? mov.id_entidad,
        lote_mp: mov.lote_afectado,
        cantidad: Math.abs(Number(mov.cantidad ?? 0)),
        unidad: 'KG',
        op_relacionada: order?.lote ?? null,
        op_lote: order?.lote ?? null,
        origen: mov.origen,
        observaciones: mov.observaciones ?? null,
      };
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
};

const buildTrazabilidadPorOP = async (): Promise<TrazabilidadPorOP[]> => {
  const [orders, ptStock, ptMovs, snapshot] = await Promise.all([
    mockOrdenService.getAll(),
    mockStockPTService.getAll(),
    mockStockPTService.getMovimientos(),
    Promise.resolve(getMockStockSnapshot()),
  ]);

  const stockByLot = new Map(snapshot.stockDB.map((lote) => [lote.lote, lote]));

  return orders.map((order) => {
    const planificada = (order.detalle_insumos ?? []).map((detalle) => ({
      insumo: detalle.nombre_insumo,
      lote_mp: detalle.id_lote,
      cantidad: Number(detalle.cantidad_usada ?? 0),
      unidad: detalle.tipo_unidad,
      costo_unitario: Number(detalle.costo_unitario ?? 0),
      costo_total: Number(detalle.costo_total ?? 0),
    }));

    const movimientosBase = snapshot.movimientosDB.length > 0
      ? snapshot.movimientosDB
      : order.estado === 'FINALIZADO'
        ? (order.detalle_insumos ?? []).map((detalle, index) => ({
            uid: `mov-aud-${order.id}-${index}`,
            fecha: new Date(order.fecha_creacion),
            id_usuario: order.usuario_responsable ?? '',
            tipo: 'SALIDA' as const,
            origen: 'PRODUCCION' as const,
            id_entidad: detalle.id_insumo,
            nombre_entidad: detalle.nombre_insumo ?? detalle.id_insumo,
            cantidad: -Math.abs(Number(detalle.cantidad_usada ?? 0)),
            lote_afectado: detalle.id_lote,
            observaciones: `Consumo por OP ${order.lote}`,
          }))
        : [];

    const movimientos = movimientosBase
      .filter((mov) => (order.detalle_insumos ?? []).some((detalle) => detalle.id_lote === mov.lote_afectado))
      .map((mov) => {
        const stock = stockByLot.get(mov.lote_afectado);
        const insumo = stock ? insumoByUid.get(stock.id_insumo) : undefined;
        return {
          fecha: toIso(mov.fecha),
          tipo_movimiento: mov.tipo,
          insumo: insumo?.nombre ?? stock?.id_insumo ?? mov.id_entidad,
          lote_mp: mov.lote_afectado,
          cantidad: Math.abs(Number(mov.cantidad ?? 0)),
          unidad: 'KG',
          op_relacionada: order.lote,
          op_lote: order.lote,
          origen: mov.origen,
          observaciones: mov.observaciones ?? null,
        };
      });

    const ptGenerado = ptStock
      .filter((pt) => pt.numero_orden === order.lote || pt.id_orden === order.id)
      .map((pt) => ({
        stock_pt_id: pt.uid,
        lote_pt: pt.lote,
        cantidad: Number(pt.cantidad_total ?? 0),
        unidad: pt.unidad_medida,
        silo: pt.nombre_silo || null,
        fecha: pt.fecha_ingreso,
      }));

    const salidasPt = ptMovs
      .filter((mov: PtMovementLike) => mov.numero_orden === order.lote || mov.stock_pt_id === ptGenerado[0]?.stock_pt_id)
      .map((mov) => ({
        tipo: mov.tipo,
        cantidad: Number(mov.cantidad ?? 0),
        motivo: mov.motivo ?? null,
        referencia: mov.referencia ?? null,
        fecha: mov.created_at,
      }));

    const eventos: TrazabilidadPorOP['eventos'] = [];
    if (movimientos.length > 0) {
      eventos.push({
        tipo: 'CONSUMO_MP',
        referencia: `Consumo MP ${order.lote}`,
        fecha: movimientos[0].fecha,
        payload: { lotes: movimientos.map((mov) => mov.lote_mp) },
      });
    }
    if (order.estado === 'FINALIZADO') {
      eventos.push({
        tipo: 'PRODUCCION_FIN',
        referencia: `Finalización OP ${order.lote}`,
        fecha: toIso(order.fecha_creacion),
        payload: { cantidad_real: order.cantidad_real ?? null, merma_manual: order.merma_manual ?? null },
      });
      if (ptGenerado[0]) {
        eventos.push({
          tipo: 'INGRESO_PT',
          referencia: `Ingreso PT ${ptGenerado[0].lote_pt}`,
          fecha: ptGenerado[0].fecha,
          payload: { lote_pt: ptGenerado[0].lote_pt, silo: ptGenerado[0].silo },
        });
      }
    } else if (order.estado === 'EN PROCESO') {
      eventos.push({
        tipo: 'PRODUCCION_INICIO',
        referencia: `Producción en proceso ${order.lote}`,
        fecha: toIso(order.fecha_creacion),
        payload: { estado: order.estado },
      });
    }

    return {
      op_id: order.id,
      orden_legacy_uid: order.lote,
      numero_orden: order.lote,
      producto: order.nombre_producto,
      formula: order.id_formula,
      version_formula: order.version_formula,
      estado_op: order.estado,
      cantidad_objetivo: order.cantidad_objetivo,
      cantidad_real: order.cantidad_real ?? null,
      merma_manual: order.merma_manual ?? null,
      destino_silo: order.destino_silo ?? null,
      usuario_responsable: order.usuario_responsable ?? null,
      fecha_creacion: order.fecha_creacion,
      actualizada_en: order.fecha_creacion,
      mp_planificada: planificada,
      lotes_mp_usados: [...new Set(planificada.map((item) => item.lote_mp))],
      mp_movimientos: movimientos,
      pt_generado: ptGenerado,
      salidas_pt: salidasPt,
      eventos,
    };
  });
};

export const mockTrazabilidadService = {
  getMovimientosMPAuditoria: async () => buildMovimientos(),
  getTrazabilidadPorOP: async () => buildTrazabilidadPorOP(),
};
