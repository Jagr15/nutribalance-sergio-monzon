import type { Comprobante } from '../services/comprobanteService';

export function filterComprobantes(
  comprobantes: Comprobante[],
  searchTerm: string,
  tipoFilter: string,
  estadoFilter: string
): Comprobante[] {
  return comprobantes.filter((c) => {
    const matchSearch = [
      c.numero,
      c.tercero,
      c.tipo,
      c.estado,
    ].some(val => (val ?? '').toLowerCase().includes(searchTerm.toLowerCase()));

    const matchTipo = tipoFilter ? c.tipo === tipoFilter : true;
    const matchEstado = estadoFilter ? c.estado === estadoFilter : true;

    return matchSearch && matchTipo && matchEstado;
  });
}

export function paginateComprobantes(
  comprobantes: Comprobante[],
  page: number,
  itemsPerPage = 10
): Comprobante[] {
  const totalPages = Math.max(1, Math.ceil(comprobantes.length / itemsPerPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * itemsPerPage;
  return comprobantes.slice(start, start + itemsPerPage);
}
