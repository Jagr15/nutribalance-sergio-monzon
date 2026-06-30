export const TipoEmpaque = {
  BOLSA: 'BOLSA',
  BIG_BAG: 'BIG_BAG',
} as const;

export type TipoEmpaque = (typeof TipoEmpaque)[keyof typeof TipoEmpaque];

export const CapacidadesBolsa = [15, 20, 25, 40] as const;
export const CapacidadesBigBag = [500, 1000] as const;
export type CapacidadEmpaque = (typeof CapacidadesBolsa)[number] | (typeof CapacidadesBigBag)[number];

export interface ConfiguracionEmpaque {
  id: string;
  producto_id?: string | null;
  tipo_empaque: TipoEmpaque;
  capacidad_kg: CapacidadEmpaque;
  esta_activo: boolean;
  activo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrearConfiguracionEmpaquePayload {
  tipo_empaque: TipoEmpaque;
  capacidad_kg: CapacidadEmpaque;
  producto_id?: string;
}

export type ActualizarConfiguracionEmpaquePayload = Partial<CrearConfiguracionEmpaquePayload> & { esta_activo?: boolean };
