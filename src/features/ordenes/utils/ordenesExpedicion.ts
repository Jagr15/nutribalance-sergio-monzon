import type { OrdenExpedicion } from '../types';

export const actualizarOrdenExpedicionEnLista = (
  ordenes: OrdenExpedicion[],
  ordenActualizada: OrdenExpedicion
) => ordenes.map((orden) => (orden.id === ordenActualizada.id ? ordenActualizada : orden));
