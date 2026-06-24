import type { Silo } from '../types';

export const isMateriaPrimaSilo = (silo: Silo) => silo.tipo_uso === 'MATERIA_PRIMA';

export const isProductoTerminadoSilo = (silo: Silo) => silo.tipo_uso === 'PRODUCTO_TERMINADO';

export const getMateriaPrimaSilos = (silos: Silo[]) => silos.filter(isMateriaPrimaSilo);

export const getProductoTerminadoSilos = (silos: Silo[]) => silos.filter(isProductoTerminadoSilo);

export const findSiloByName = (silos: Silo[], nombre: string) =>
  silos.find((silo) => silo.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()) ?? null;
