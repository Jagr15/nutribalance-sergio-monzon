import { TipoUnidad } from '../../../shared/types/global.interface';

export type UnidadPrecioMP = 'KG' | 'TON';

export interface CostoIngresoMPInput {
  cantidad: number;
  unidad_entrada: TipoUnidad;
  precio_unitario?: number;
  unidad_precio?: UnidadPrecioMP;
  costo_total?: number;
}

export interface CostoIngresoMPResult {
  cantidad_kg: number;
  precio_unitario_kg: number;
  costo_total: number;
}

const round6 = (value: number) => Number(value.toFixed(6));

const toKgFactor = (unidad: TipoUnidad | UnidadPrecioMP) => (unidad === 'TON' ? 1000 : 1);

export const calcularCostoIngresoMP = (input: CostoIngresoMPInput): CostoIngresoMPResult => {
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor a 0.');
  }

  const cantidadKg = round6(input.cantidad * toKgFactor(input.unidad_entrada));
  if (cantidadKg <= 0) {
    throw new Error('La cantidad convertida debe ser mayor a 0.');
  }

  const precioUnitario = Number(input.precio_unitario ?? 0);
  if (Number.isFinite(precioUnitario) && precioUnitario > 0) {
    const factorPrecio = input.unidad_precio === 'TON' ? 1000 : 1;
    const precioUnitarioKg = round6(precioUnitario / factorPrecio);
    return {
      cantidad_kg: cantidadKg,
      precio_unitario_kg: precioUnitarioKg,
      costo_total: round6(precioUnitarioKg * cantidadKg),
    };
  }

  const costoTotal = Number(input.costo_total ?? 0);
  if (!Number.isFinite(costoTotal) || costoTotal <= 0) {
    throw new Error('Debe informar precio unitario o costo total.');
  }

  return {
    cantidad_kg: cantidadKg,
    precio_unitario_kg: round6(costoTotal / cantidadKg),
    costo_total: round6(costoTotal),
  };
};
