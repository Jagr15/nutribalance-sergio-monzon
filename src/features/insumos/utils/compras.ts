import type { HistorialCompraMP, StockMateriaPrima, UltimoPrecioPagadoInsumo } from '../types';

type SourceInsumo = {
  uid: string;
  nombre?: string;
};

type SourceProveedor = {
  uid: string;
  nombre_empresa?: string;
};

const num = (value: unknown) => Number(value ?? 0);

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

const sortByCompra = (a: StockMateriaPrima, b: StockMateriaPrima) => {
  const aTime = new Date(a.fecha_ingreso).getTime();
  const bTime = new Date(b.fecha_ingreso).getTime();
  if (aTime !== bTime) return bTime - aTime;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
};

export const buildHistorialCompras = (
  lotes: StockMateriaPrima[],
  insumos: SourceInsumo[],
  proveedores: SourceProveedor[],
): HistorialCompraMP[] => {
  const insumoById = new Map(insumos.map((item) => [item.uid, item]));
  const proveedorById = new Map(proveedores.map((item) => [item.uid, item]));

  return [...lotes]
    .filter((lote) => Boolean(lote.id_insumo) && Boolean(lote.id_proveedor))
    .sort(sortByCompra)
    .map((lote) => ({
      proveedor: proveedorById.get(lote.id_proveedor)?.nombre_empresa ?? 'Sin dato',
      id_proveedor: lote.id_proveedor,
      insumo: insumoById.get(lote.id_insumo)?.nombre ?? 'Sin dato',
      id_insumo: lote.id_insumo,
      fecha_compra: toIso(lote.fecha_ingreso),
      lote: lote.lote,
      remito_nro: lote.remito_nro,
      cantidad: num(lote.cantidad_inicial ?? lote.cantidad_actual),
      costo_unitario: num(lote.costo_unitario),
      costo_total: num(lote.costo_total),
    }));
};

export const buildUltimosPrecios = (
  lotes: StockMateriaPrima[],
  insumos: SourceInsumo[],
  proveedores: SourceProveedor[],
): UltimoPrecioPagadoInsumo[] => {
  const historial = buildHistorialCompras(lotes, insumos, proveedores);
  const grouped = new Map<string, HistorialCompraMP[]>();

  historial.forEach((compra) => {
    const current = grouped.get(compra.id_insumo) ?? [];
    current.push(compra);
    grouped.set(compra.id_insumo, current);
  });

  return [...grouped.values()].map((compras) => {
    const [ultima, anterior] = compras;
    const precioActual = num(ultima?.costo_unitario);
    const precioAnterior = anterior ? num(anterior.costo_unitario) : null;
    const variacionAbsoluta = precioAnterior === null ? null : Number((precioActual - precioAnterior).toFixed(6));
    const variacionPct = precioAnterior && precioAnterior !== 0
      ? Number((((precioActual - precioAnterior) / precioAnterior) * 100).toFixed(2))
      : null;

    return {
      insumo: ultima?.insumo ?? 'Sin dato',
      id_insumo: ultima?.id_insumo ?? '',
      ultimo_proveedor: ultima?.proveedor ?? 'Sin dato',
      id_proveedor: ultima?.id_proveedor ?? '',
      fecha_ultima_compra: ultima?.fecha_compra ?? '',
      ultimo_precio: precioActual,
      precio_compra_anterior: precioAnterior,
      variacion_absoluta: variacionAbsoluta,
      variacion_pct: variacionPct,
    };
  }).sort((a, b) => {
    const aTime = new Date(a.fecha_ultima_compra).getTime();
    const bTime = new Date(b.fecha_ultima_compra).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return a.insumo.localeCompare(b.insumo);
  });
};

export const buildCompraKpis = (historial: HistorialCompraMP[], proveedoresActivos: number) => {
  const ultimaCompra = historial[0] ?? null;
  return {
    comprasRegistradas: historial.length,
    proveedoresActivos,
    ultimaCompra,
  };
};
