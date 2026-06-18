import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT, StockProductoTerminadoResumen } from '../../productos/types';

const num = (value: unknown) => Number(value ?? 0);

const salidaTypes = new Set(['SALIDA', 'DESPACHO_PT']);

export interface DashboardPTSalidaProducto {
  producto_id: string;
  nombre_producto: string;
  kg_salidos: number;
  cantidad_movimientos: number;
  ultima_salida: string | null;
}

export interface DashboardPTParticipacionProducto {
  producto_id: string | null;
  nombre_producto: string;
  stock_actual: number;
  porcentaje: number;
}

export interface DashboardPTEntregaCliente {
  cliente_id: string | null;
  cliente_nombre: string;
  producto_id: string | null;
  producto_nombre: string;
  kg: number;
  fecha: string;
  referencia: string | null;
}

export interface DashboardPTInsights {
  salidasPorProducto: DashboardPTSalidaProducto[];
  participacionStock: DashboardPTParticipacionProducto[];
  entregasPorCliente: DashboardPTEntregaCliente[];
}

const resolveClienteNombre = (clienteId: string | null | undefined, clientes: Cliente[]) => {
  if (!clienteId) return 'Sin cliente asociado';
  return clientes.find((cliente) => cliente.uid === clienteId)?.nombre ?? 'Sin cliente asociado';
};

export const buildProductoTerminadoInsights = (
  stockResumenes: StockProductoTerminadoResumen[],
  movimientos: MovimientoStockPT[],
  clientes: Cliente[]
): DashboardPTInsights => {
  const stockTotal = Math.max(1, stockResumenes.reduce((acc, item) => acc + num(item.stock_actual), 0));

  const salidas = movimientos.filter((mov) => salidaTypes.has(mov.tipo));
  const salidasByProducto = new Map<string, DashboardPTSalidaProducto>();

  salidas.forEach((movimiento) => {
    const key = movimiento.producto_id ?? movimiento.nombre_producto;
    const current = salidasByProducto.get(key) ?? {
      producto_id: movimiento.producto_id ?? key,
      nombre_producto: movimiento.nombre_producto,
      kg_salidos: 0,
      cantidad_movimientos: 0,
      ultima_salida: null,
    };

    current.kg_salidos += num(movimiento.cantidad);
    current.cantidad_movimientos += 1;
    if (!current.ultima_salida || new Date(movimiento.created_at).getTime() > new Date(current.ultima_salida).getTime()) {
      current.ultima_salida = movimiento.created_at;
    }
    salidasByProducto.set(key, current);
  });

  const participacionStock = [...stockResumenes]
    .sort((a, b) => b.stock_actual - a.stock_actual)
    .map((item) => ({
      producto_id: item.producto_id,
      nombre_producto: item.nombre_producto,
      stock_actual: num(item.stock_actual),
      porcentaje: (num(item.stock_actual) / stockTotal) * 100,
    }));

  const entregasPorCliente = salidas
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map((movimiento) => ({
      cliente_id: movimiento.cliente_id ?? null,
      cliente_nombre: movimiento.cliente_nombre ?? resolveClienteNombre(movimiento.cliente_id, clientes),
      producto_id: movimiento.producto_id ?? null,
      producto_nombre: movimiento.nombre_producto,
      kg: num(movimiento.cantidad),
      fecha: movimiento.created_at,
      referencia: movimiento.referencia ?? null,
    }));

  return {
    salidasPorProducto: [...salidasByProducto.values()].sort((a, b) => b.kg_salidos - a.kg_salidos).slice(0, 6),
    participacionStock: participacionStock.slice(0, 6),
    entregasPorCliente,
  };
};
