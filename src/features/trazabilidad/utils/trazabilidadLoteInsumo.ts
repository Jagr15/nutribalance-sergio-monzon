import type { Cliente } from '../../clientes/types/cliente';
import type { Proveedor } from '../../proveedores/types/proveedor';
import type { StockMateriaPrima } from '../../insumos/types';
import type { MovimientoStockPT } from '../../productos/types';
import type { OrdenProduccion } from '../../ordenes/types';
import type { TrazabilidadLoteInsumoResultado, TrazabilidadPorOP } from '../types';

const fmtName = (value: string | null | undefined, fallback: string) => {
  const text = (value ?? '').trim();
  return text.length > 0 ? text : fallback;
};

interface BuildArgs {
  lotes: StockMateriaPrima[];
  insumoById: Map<string, string>;
  proveedoresById: Map<string, Proveedor>;
  ordenes: OrdenProduccion[];
  trazabilidadOP: TrazabilidadPorOP[];
  movimientosPT: MovimientoStockPT[];
  clientes: Cliente[];
}

export const buildTrazabilidadLoteInsumo = (
  loteUid: string,
  {
    lotes,
    insumoById,
    proveedoresById,
    ordenes,
    trazabilidadOP,
    movimientosPT,
    clientes,
  }: BuildArgs,
): TrazabilidadLoteInsumoResultado | null => {
  const lote = lotes.find((item) => item.uid === loteUid || item.lote === loteUid);
  if (!lote) return null;

  const insumoNombre = insumoById.get(lote.id_insumo) ?? lote.id_insumo;
  const proveedor = lote.id_proveedor ? proveedoresById.get(lote.id_proveedor) ?? null : null;

  const usos = trazabilidadOP.flatMap((op) => {
    const usaLote = op.lotes_mp_usados.includes(lote.lote)
      || op.mp_planificada.some((item) => item.lote_mp === lote.lote || item.lote_mp === lote.uid)
      || op.mp_movimientos.some((mov) => mov.lote_mp === lote.lote || mov.lote_mp === lote.uid);

    if (!usaLote) return [];

    const orden = ordenes.find((item) => item.id === op.orden_legacy_uid || item.lote === op.numero_orden || item.lote === op.orden_legacy_uid);
    const pt = op.pt_generado[0] ?? null;

    return [{
      orden_id: orden?.id ?? op.orden_legacy_uid ?? op.numero_orden,
      orden_lote: orden?.lote ?? op.numero_orden,
      producto: orden?.nombre_producto ?? op.producto,
      formula: op.formula,
      version_formula: op.version_formula,
      estado_op: op.estado_op,
      fecha_creacion: op.fecha_creacion,
      lote_pt: pt?.lote_pt ?? null,
      stock_pt_id: pt?.stock_pt_id ?? null,
      ventas: [],
    }];
  });

  const lotesPtRelacionados = new Map<string, { stock_pt_id: string | null; lote_pt: string | null }>();
  usos.forEach((uso) => {
    if (uso.stock_pt_id || uso.lote_pt) {
      lotesPtRelacionados.set(uso.stock_pt_id ?? uso.lote_pt ?? '', {
        stock_pt_id: uso.stock_pt_id,
        lote_pt: uso.lote_pt,
      });
    }
  });

  const ventas = movimientosPT
    .filter((mov) => mov.tipo === 'SALIDA')
    .filter((mov) =>
      (mov.numero_orden && usos.some((uso) => uso.orden_lote === mov.numero_orden || uso.orden_id === mov.numero_orden))
      || (mov.stock_pt_id && lotesPtRelacionados.has(mov.stock_pt_id))
      || (mov.lote && [...lotesPtRelacionados.values()].some((pt) => pt.lote_pt === mov.lote))
    )
    .map((mov) => ({
      fecha: mov.created_at,
      tipo: mov.tipo,
      cantidad: Number(mov.cantidad ?? 0),
      motivo: mov.motivo ?? null,
      referencia: mov.referencia ?? null,
      cliente_id: mov.cliente_id ?? null,
      cliente_nombre: mov.cliente_nombre ?? clientes.find((cliente) => cliente.uid === mov.cliente_id)?.nombre ?? null,
      stock_pt_id: mov.stock_pt_id ?? null,
      lote_pt: mov.lote ?? null,
    }))
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const cliente_final = ventas.find((venta) => venta.cliente_nombre)?.cliente_nombre ?? null;
  const usosConVentas = usos.map((uso) => {
    const ventasUso = ventas.filter((venta) => {
      if (uso.stock_pt_id && venta.stock_pt_id === uso.stock_pt_id) return true;
      if (uso.lote_pt && venta.lote_pt === uso.lote_pt) return true;
      if (uso.orden_lote && venta.referencia?.includes(uso.orden_lote)) return true;
      return false;
    });
    return {
      ...uso,
      ventas: ventasUso,
    };
  });
  const advertencias: string[] = [];
  if (usosConVentas.length === 0) advertencias.push('No se encontró una orden/producción asociada a este lote.');
  if (usosConVentas.some((uso) => !uso.lote_pt)) advertencias.push('La producción asociada no expone lote PT generado.');
  if (ventas.length === 0) advertencias.push('No se encontraron ventas/pedidos asociados al lote producido.');
  if (ventas.some((venta) => !venta.cliente_nombre)) advertencias.push('Hay salidas PT sin cliente final informado.');

  return {
    lote_insumo: {
      uid: lote.uid,
      lote: lote.lote,
      insumo_id: lote.id_insumo,
      insumo_nombre: insumoNombre,
      fecha_ingreso: new Date(lote.fecha_ingreso).toISOString(),
      proveedor_id: lote.id_proveedor ?? null,
      proveedor_nombre: proveedor ? fmtName(proveedor.nombre_empresa, 'Sin proveedor') : null,
      cantidad_actual: Number(lote.cantidad_actual ?? 0),
      cantidad_inicial: lote.cantidad_inicial ?? null,
      ubicacion: lote.ubicacion ?? null,
    },
    usos: usosConVentas,
    ventas,
    cliente_final,
    advertencias,
    trazabilidad_completa: advertencias.length === 0,
  };
};
