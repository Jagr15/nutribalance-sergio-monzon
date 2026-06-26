import type { OrdenExpedicion } from '../types';

export const actualizarOrdenExpedicionEnLista = (
  ordenes: OrdenExpedicion[],
  ordenActualizada: OrdenExpedicion
) => ordenes.map((orden) => (orden.id === ordenActualizada.id ? ordenActualizada : orden));

export const cancelarOrdenExpedicionEnLista = (
  ordenes: OrdenExpedicion[],
  ordenId: string,
  fallback?: OrdenExpedicion | null
) => ordenes.map((orden) => {
  if (orden.id !== ordenId) return orden;
  return {
    ...orden,
    ...(fallback ?? {}),
    estado: 'cancelada' as OrdenExpedicion['estado'],
  } as OrdenExpedicion;
});

export const puedeMostrarAccionesOrdenSalida = (estado: OrdenExpedicion['estado']) =>
  estado === 'pendiente' || estado === 'preparando' || estado === 'lista';
