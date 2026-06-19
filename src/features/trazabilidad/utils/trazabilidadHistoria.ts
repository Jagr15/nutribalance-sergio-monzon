import type { Cliente } from '../../clientes/types/cliente';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import type { OrdenExpedicion, OrdenProduccion } from '../../ordenes/types';
import type { MovimientoStockPT } from '../../productos/types';
import type { Proveedor } from '../../proveedores/types/proveedor';
import type {
  SentidoTrazabilidad,
  TrazabilidadHistoriaResultado,
  TrazabilidadMovimientoHistoria,
  TrazabilidadPorOP,
} from '../types';

interface BuildArgs {
  lotes: StockMateriaPrima[];
  insumos: Insumo[];
  ordenes: OrdenProduccion[];
  trazabilidadOP: TrazabilidadPorOP[];
  movimientosPT: MovimientoStockPT[];
  expediciones: OrdenExpedicion[];
  clientes: Cliente[];
  proveedores: Proveedor[];
}

const toIso = (value: string | Date | null | undefined) => {
  if (!value) return new Date(0).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const normalize = (value: string) => value.trim().toLowerCase();

const inRange = (value: string, desde: Date | null, hasta: Date | null) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  if (desde && date < desde) return false;
  if (hasta) {
    const limit = new Date(hasta);
    limit.setHours(23, 59, 59, 999);
    if (date > limit) return false;
  }
  return true;
};

const buildMovimiento = (input: TrazabilidadMovimientoHistoria): TrazabilidadMovimientoHistoria => input;

export const buildTrazabilidadHistoria = (
  params: {
    sentido: SentidoTrazabilidad;
    loteInsumo?: string;
    producto?: string;
    venta?: string;
    cliente?: string;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
  },
  data: BuildArgs,
): TrazabilidadHistoriaResultado | null => {
  const fechaDesde = params.fechaDesde ? new Date(params.fechaDesde) : null;
  const fechaHasta = params.fechaHasta ? new Date(params.fechaHasta) : null;

  const lotesByLote = new Map(data.lotes.map((item) => [normalize(item.lote), item] as const));
  const insumosById = new Map(data.insumos.map((item) => [item.uid, item] as const));
  const clientesByNombre = new Map(data.clientes.map((item) => [normalize(item.nombre), item] as const));
  const proveedoresById = new Map(data.proveedores.map((item) => [item.uid, item] as const));

  if (params.sentido === 'ADELANTE') {
    const query = normalize(params.loteInsumo ?? '');
    if (!query) return null;

    const lote = lotesByLote.get(query) ?? data.lotes.find((item) => normalize(item.uid) === query);
    if (!lote) return null;

    const insumo = insumosById.get(lote.id_insumo) ?? null;
    const usos = data.trazabilidadOP.filter((op) =>
      op.lotes_mp_usados.includes(lote.lote) ||
      op.mp_planificada.some((item) => normalize(item.lote_mp) === query || normalize(item.lote_mp) === normalize(lote.lote)) ||
      op.mp_movimientos.some((mov) => normalize(mov.lote_mp) === query || normalize(mov.lote_mp) === normalize(lote.lote))
    );

    const movimientosBase: TrazabilidadMovimientoHistoria[] = [
      buildMovimiento({
        fecha: toIso(lote.fecha_ingreso),
        tipo: 'INGRESO_MP',
        referencia: lote.remito_nro,
        entidad: 'Insumo',
        detalle: `${insumo?.nombre ?? lote.id_insumo} · Lote ${lote.lote}${lote.id_proveedor ? ` · ${proveedoresById.get(lote.id_proveedor)?.nombre_empresa ?? 'Sin proveedor'}` : ''}`,
        orden_lote: null,
        lote_mp: lote.lote,
        lote_pt: null,
        venta: null,
        cliente: null,
      }),
    ];

    usos.forEach((op) => {
      movimientosBase.push(buildMovimiento({
        fecha: toIso(op.fecha_creacion),
        tipo: 'CONSUMO_MP',
        referencia: op.numero_orden,
        entidad: 'Producción',
        detalle: `${op.producto} · ${op.estado_op}`,
        orden_lote: op.numero_orden,
        lote_mp: lote.lote,
        lote_pt: op.pt_generado[0]?.lote_pt ?? null,
        venta: null,
        cliente: null,
      }));

      op.pt_generado.forEach((pt) => {
        movimientosBase.push(buildMovimiento({
          fecha: toIso(pt.fecha),
          tipo: 'INGRESO_PT',
          referencia: pt.lote_pt,
          entidad: 'Producto terminado',
          detalle: `${op.producto} · ${pt.lote_pt}`,
          orden_lote: op.numero_orden,
          lote_mp: lote.lote,
          lote_pt: pt.lote_pt,
          venta: null,
          cliente: null,
        }));

        data.movimientosPT
          .filter((mov) => mov.stock_pt_id === pt.stock_pt_id || mov.lote === pt.lote_pt || mov.numero_orden === op.numero_orden)
          .forEach((mov) => {
            const exp = data.expediciones.find((item) => item.stock_pt_id === mov.stock_pt_id || item.lote_pt === mov.lote);
            movimientosBase.push(buildMovimiento({
              fecha: toIso(mov.created_at),
              tipo: mov.tipo,
              referencia: mov.referencia ?? exp?.numero_expedicion ?? null,
              entidad: 'Venta / pedido',
              detalle: `${mov.nombre_producto} · ${mov.cantidad.toLocaleString('es-AR')} kg`,
              orden_lote: op.numero_orden,
              lote_mp: lote.lote,
              lote_pt: mov.lote,
              venta: exp?.numero_expedicion ?? null,
              cliente: mov.cliente_nombre ?? exp?.cliente_nombre ?? null,
            }));
          });
      });
    });

    const movimientos = movimientosBase
      .filter((mov) => inRange(mov.fecha, fechaDesde, fechaHasta))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    const advertencias: string[] = [];
    if (usos.length === 0) advertencias.push('No se encontró una orden/producción asociada a este lote.');
    if (usos.some((op) => op.pt_generado.length === 0)) advertencias.push('La producción asociada no expone lote PT generado.');
    if (movimientos.every((mov) => mov.tipo !== 'SALIDA')) advertencias.push('No se encontró salida/venta del producto terminado.');

    return {
      sentido: 'ADELANTE',
      origen: lote.lote,
      destino: movimientos.at(-1)?.cliente ?? movimientos.at(-1)?.venta ?? null,
      trazabilidad_completa: advertencias.length === 0,
      advertencias,
      movimientos,
    };
  }

  const query = normalize(params.venta ?? params.producto ?? params.cliente ?? '');
  if (!query) return null;

  const exp = data.expediciones.find((item) =>
    normalize(item.numero_expedicion) === query ||
    normalize(item.referencia ?? '') === query ||
    normalize(item.nombre_producto) === query ||
    normalize(item.cliente_nombre ?? '') === query
  );
  if (!exp) return null;

  const cliente = clientesByNombre.get(normalize(exp.cliente_nombre ?? '')) ?? data.clientes.find((item) => item.uid === exp.cliente_id) ?? null;
  const movimientoPt = data.movimientosPT.find((mov) => mov.stock_pt_id === exp.stock_pt_id || mov.lote === exp.lote_pt) ?? null;
  const op = data.trazabilidadOP.find((item) => item.pt_generado.some((ptItem) => ptItem.stock_pt_id === exp.stock_pt_id || ptItem.lote_pt === exp.lote_pt)) ?? null;
  const orden = data.ordenes.find((item) => item.id === op?.orden_legacy_uid || item.lote === op?.numero_orden || item.nombre_producto === exp.nombre_producto) ?? null;
  const lotesUsados = op ? data.lotes.filter((lote) => op.lotes_mp_usados.includes(lote.lote)) : [];

  const movimientosBase: TrazabilidadMovimientoHistoria[] = [
    buildMovimiento({
      fecha: toIso(exp.created_at),
      tipo: 'SALIDA',
      referencia: exp.referencia ?? exp.numero_expedicion,
      entidad: 'Venta / pedido',
      detalle: `${exp.nombre_producto} · ${exp.cantidad.toLocaleString('es-AR')} kg`,
      orden_lote: orden?.lote ?? op?.numero_orden ?? null,
      lote_mp: lotesUsados[0]?.lote ?? null,
      lote_pt: exp.lote_pt,
      venta: exp.numero_expedicion,
      cliente: cliente?.nombre ?? exp.cliente_nombre,
    }),
  ];

  if (movimientoPt) {
    movimientosBase.push(buildMovimiento({
      fecha: toIso(movimientoPt.created_at),
      tipo: movimientoPt.tipo,
      referencia: movimientoPt.referencia ?? null,
      entidad: 'Producto terminado',
      detalle: `${movimientoPt.nombre_producto} · ${movimientoPt.lote}`,
      orden_lote: movimientoPt.numero_orden,
      lote_mp: lotesUsados[0]?.lote ?? null,
      lote_pt: movimientoPt.lote,
      venta: exp.numero_expedicion,
      cliente: cliente?.nombre ?? exp.cliente_nombre,
    }));
  }

  if (op || orden) {
    movimientosBase.push(buildMovimiento({
      fecha: toIso(op?.fecha_creacion ?? orden?.fecha_creacion),
      tipo: 'CONSUMO_MP',
      referencia: op?.numero_orden ?? orden?.lote ?? null,
      entidad: 'Producción',
      detalle: `${op?.producto ?? orden?.nombre_producto ?? exp.nombre_producto} · ${op?.estado_op ?? orden?.estado ?? 'Sin estado'}`,
      orden_lote: orden?.lote ?? op?.numero_orden ?? null,
      lote_mp: lotesUsados[0]?.lote ?? null,
      lote_pt: movimientoPt?.lote ?? exp.lote_pt,
      venta: exp.numero_expedicion,
      cliente: cliente?.nombre ?? exp.cliente_nombre,
    }));

    lotesUsados.forEach((lote) => {
      movimientosBase.push(buildMovimiento({
        fecha: toIso(lote.fecha_ingreso),
        tipo: 'INGRESO_MP',
        referencia: lote.remito_nro,
        entidad: 'Insumo',
        detalle: `${lote.lote} · ${insumosById.get(lote.id_insumo)?.nombre ?? lote.id_insumo}${lote.id_proveedor ? ` · ${proveedoresById.get(lote.id_proveedor)?.nombre_empresa ?? 'Sin proveedor'}` : ''}`,
        orden_lote: null,
        lote_mp: lote.lote,
        lote_pt: null,
        venta: exp.numero_expedicion,
        cliente: cliente?.nombre ?? exp.cliente_nombre,
      }));
    });
  }

  const movimientos = movimientosBase
    .filter((mov) => inRange(mov.fecha, fechaDesde, fechaHasta))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const advertencias: string[] = [];
  if (!op && !orden) advertencias.push('No se encontró producción relacionada con la venta seleccionada.');
  if (lotesUsados.length === 0) advertencias.push('No se encontraron lotes de insumo asociados a la producción.');
  if (!movimientoPt) advertencias.push('No se encontró movimiento de producto terminado para la venta seleccionada.');

  return {
    sentido: 'ATRAS',
    origen: exp.numero_expedicion,
    destino: lotesUsados.map((item) => item.lote).join(', ') || null,
    trazabilidad_completa: advertencias.length === 0,
    advertencias,
    movimientos,
  };
};
