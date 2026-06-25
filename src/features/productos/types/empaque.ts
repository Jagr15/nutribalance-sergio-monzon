export const TipoEmpaque = {
  BOLSA: 'BOLSA',
  BIG_BAG: 'BIG_BAG',
} as const;

export type TipoEmpaque = (typeof TipoEmpaque)[keyof typeof TipoEmpaque];

export const CapacidadesBolsa = [15, 20, 25, 40] as const;
export const CapacidadesBigBag = [500, 1000] as const;

export type CapacidadEmpaque = (typeof CapacidadesBolsa)[number] | (typeof CapacidadesBigBag)[number];

export interface EmpaqueProducto {
  id: string;
  producto_id: string;
  tipo_empaque: TipoEmpaque;
  capacidad_kg: CapacidadEmpaque;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrearEmpaqueProductoPayload {
  producto_id: string;
  tipo_empaque: TipoEmpaque;
  capacidad_kg: CapacidadEmpaque;
}

export type ActualizarEmpaqueProductoPayload = Partial<CrearEmpaqueProductoPayload> & { activo?: boolean };
