import type { CapacidadEmpaque, EmpaqueProducto, TipoEmpaque } from '../../productos/types';

export type ModoCálculoEmpaque = 'EMPAQUES' | 'KG';

export interface CálculoEmpaqueResultado {
  tipo_empaque: TipoEmpaque;
  capacidad_kg: CapacidadEmpaque;
  cantidad_empaques: number;
  total_kg: number;
  sobrante_kg: number;
  faltante_kg: number;
}

export const calcularEmpaques = (
  modo: ModoCálculoEmpaque,
  valor: number,
  empaque: Pick<EmpaqueProducto, 'tipo_empaque' | 'capacidad_kg'>
): CálculoEmpaqueResultado => {
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('El valor debe ser mayor a 0.');
  if (!Number.isInteger(valor) && modo === 'EMPAQUES') throw new Error('La cantidad de empaques debe ser un entero.');

  const capacidad = Number(empaque.capacidad_kg);
  const tipo = empaque.tipo_empaque;
  if (!Number.isFinite(capacidad) || capacidad <= 0) throw new Error('La capacidad no es válida.');

  if (modo === 'EMPAQUES') {
    const cantidadEmpaques = Math.trunc(valor);
    const totalKg = cantidadEmpaques * capacidad;
    return {
      tipo_empaque: tipo,
      capacidad_kg: capacidad as CapacidadEmpaque,
      cantidad_empaques: cantidadEmpaques,
      total_kg: totalKg,
      sobrante_kg: 0,
      faltante_kg: 0,
    };
  }

  const cantidadEmpaques = Math.ceil(valor / capacidad);
  const totalKg = cantidadEmpaques * capacidad;
  return {
    tipo_empaque: tipo,
    capacidad_kg: capacidad as CapacidadEmpaque,
    cantidad_empaques: cantidadEmpaques,
    total_kg: totalKg,
    sobrante_kg: totalKg - valor,
    faltante_kg: 0,
  };
};

