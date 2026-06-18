import type { Cliente } from '../../clientes/types/cliente';
import type { OrdenExpedicion } from '../../ordenes/types';

const num = (value: unknown) => Number(value ?? 0);

export interface DashboardExpedicionProducto {
  producto_id: string;
  nombre_producto: string;
  kg_expedidos: number;
  cantidad_expediciones: number;
}

export interface DashboardExpedicionCliente {
  cliente_id: string | null;
  cliente_nombre: string;
  producto_nombre: string;
  kg: number;
  fecha: string;
  presentacion: OrdenExpedicion['presentacion'];
  referencia: string | null;
}

export interface DashboardExpedicionResumen {
  expediciones_registradas: number;
  expediciones_pendientes: number;
  kg_expedidos: number;
  clientes_atendidos: number;
  producto_mas_expedido: string;
  kg_producto_mas_expedido: number;
}

export interface DashboardExpedicionInsights {
  resumen: DashboardExpedicionResumen;
  porProducto: DashboardExpedicionProducto[];
  porCliente: DashboardExpedicionCliente[];
}

const resolveClienteNombre = (clienteId: string | null | undefined, clientes: Cliente[]) => {
  if (!clienteId) return 'Sin cliente asociado';
  return clientes.find((cliente) => cliente.uid === clienteId)?.nombre ?? 'Sin cliente asociado';
};

export const buildOrdenesExpedicionInsights = (
  expediciones: OrdenExpedicion[],
  clientes: Cliente[]
): DashboardExpedicionInsights => {
  const expedicionesVigentes = expediciones.filter((exp) => exp.estado !== 'ANULADA');
  const expedicionesPendientes = expediciones.filter((exp) => exp.estado === 'PENDIENTE').length;
  const kgExpedidos = expedicionesVigentes.reduce((acc, exp) => acc + num(exp.cantidad), 0);

  const clientesAtendidos = new Set(
    expedicionesVigentes
      .map((exp) => exp.cliente_id)
      .filter((clienteId): clienteId is string => Boolean(clienteId))
  ).size;

  const porProductoMap = new Map<string, DashboardExpedicionProducto>();
  expedicionesVigentes.forEach((exp) => {
    const key = exp.producto_id || exp.nombre_producto;
    const current = porProductoMap.get(key) ?? {
      producto_id: exp.producto_id || key,
      nombre_producto: exp.nombre_producto,
      kg_expedidos: 0,
      cantidad_expediciones: 0,
    };
    current.kg_expedidos += num(exp.cantidad);
    current.cantidad_expediciones += 1;
    porProductoMap.set(key, current);
  });

  const porProducto = [...porProductoMap.values()].sort((a, b) => b.kg_expedidos - a.kg_expedidos);
  const productoTop = porProducto[0];

  const porCliente = expedicionesVigentes
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map((exp) => ({
      cliente_id: exp.cliente_id,
      cliente_nombre: exp.cliente_nombre ?? resolveClienteNombre(exp.cliente_id, clientes),
      producto_nombre: exp.nombre_producto,
      kg: num(exp.cantidad),
      fecha: exp.created_at,
      presentacion: exp.presentacion,
      referencia: exp.referencia,
    }));

  return {
    resumen: {
      expediciones_registradas: expedicionesVigentes.length,
      expediciones_pendientes: expedicionesPendientes,
      kg_expedidos: kgExpedidos,
      clientes_atendidos: clientesAtendidos,
      producto_mas_expedido: productoTop?.nombre_producto ?? 'Sin dato',
      kg_producto_mas_expedido: productoTop?.kg_expedidos ?? 0,
    },
    porProducto: porProducto.slice(0, 6),
    porCliente,
  };
};
