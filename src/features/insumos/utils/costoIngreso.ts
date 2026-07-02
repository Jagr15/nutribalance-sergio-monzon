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

export interface CostoIngresoMPResolucion {
  cantidad_kg: number;
  costo_unitario: number;
  costo_total: number;
  fuente_costo: 'manual' | 'referencia' | 'sin_costo';
  advertencia?: string;
}

export interface ResolverCostoIngresoMPInput extends CostoIngresoMPInput {
  costo_unitario?: number | null;
  costo_por_kg?: number | null;
  ref_costo_unitario?: number | null;
  costo?: number | null;
}

const round6 = (value: number) => Number(value.toFixed(6));

const toKgFactor = (unidad: TipoUnidad | UnidadPrecioMP) => (unidad === 'TON' ? 1000 : 1);

export const calcularCantidadKgIngresoMP = (cantidad: number, unidad_entrada: TipoUnidad) => {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor a 0.');
  }

  const cantidadKg = round6(cantidad * toKgFactor(unidad_entrada));
  if (cantidadKg <= 0) {
    throw new Error('La cantidad convertida debe ser mayor a 0.');
  }

  return cantidadKg;
};

export const calcularCostoIngresoMP = (input: CostoIngresoMPInput): CostoIngresoMPResult => {
  const cantidadKg = calcularCantidadKgIngresoMP(input.cantidad, input.unidad_entrada);

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

const normalizeCost = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const resolveReferenceCost = (input: Pick<ResolverCostoIngresoMPInput, 'costo_por_kg' | 'ref_costo_unitario' | 'costo'>) => {
  const candidates = [
    normalizeCost(input.costo_por_kg),
    normalizeCost(input.ref_costo_unitario),
    normalizeCost(input.costo),
  ];

  return candidates.find((value) => typeof value === 'number' && value > 0) ?? 0;
};

export const resolverCostoIngresoMP = (input: ResolverCostoIngresoMPInput): CostoIngresoMPResolucion => {
  const cantidad_kg = calcularCantidadKgIngresoMP(input.cantidad, input.unidad_entrada);
  let costoManual = normalizeCost(input.costo_unitario);
  
  if (costoManual !== null && input.unidad_precio === 'TON') {
    costoManual = costoManual / 1000;
  }

  const costoReferencia = costoManual === null ? resolveReferenceCost(input) : 0;
  const fuente_costo: CostoIngresoMPResolucion['fuente_costo'] =
    costoManual !== null ? 'manual' : costoReferencia > 0 ? 'referencia' : 'sin_costo';
  const costo_unitario = round6(costoManual ?? costoReferencia ?? 0);
  const costo_total = round6(cantidad_kg * costo_unitario);

  return {
    cantidad_kg,
    costo_unitario,
    costo_total,
    fuente_costo,
    advertencia:
      fuente_costo === 'sin_costo'
        ? 'Este lote quedará sin costo. Las producciones y cuentas corrientes derivadas podrían quedar sin importe.'
        : fuente_costo === 'referencia'
          ? 'Usando costo de referencia del insumo.'
          : undefined,
  };
};
