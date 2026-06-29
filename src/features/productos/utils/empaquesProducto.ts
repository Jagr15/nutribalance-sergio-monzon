import type { ProductoUiLike } from '../types/empaquesProductoUi';

export const getProductoEmpaquesKey = (producto: ProductoUiLike): string => {
  const idFormula = producto.idFormula?.trim();
  if (idFormula) return idFormula;
  return producto.nombre.trim();
};

export const getProductoEmpaquesKeys = (producto: ProductoUiLike): string[] => {
  const keys = [producto.idFormula?.trim(), producto.nombre.trim()].filter((value): value is string => Boolean(value));
  return [...new Set(keys)];
};
