import type { ConfiguracionEmpaque } from '../types/configuracionEmpaque';

const DEFAULT_ID_PREFIX = 'base-configuracion-empaque';

const now = '1970-01-01T00:00:00.000Z';

const buildBaseEmpaque = (
  tipo_empaque: ConfiguracionEmpaque['tipo_empaque'],
  capacidad_kg: ConfiguracionEmpaque['capacidad_kg']
): ConfiguracionEmpaque => ({
  id: `${DEFAULT_ID_PREFIX}-${tipo_empaque}-${capacidad_kg}`,
  producto_id: null,
  tipo_empaque,
  capacidad_kg,
  esta_activo: true,
  activo: true,
  created_at: now,
  updated_at: now,
});

export const DEFAULT_CONFIGURACION_EMPAQUES: ConfiguracionEmpaque[] = [
  buildBaseEmpaque('BOLSA', 15),
  buildBaseEmpaque('BOLSA', 20),
  buildBaseEmpaque('BOLSA', 25),
  buildBaseEmpaque('BOLSA', 40),
  buildBaseEmpaque('BIG_BAG', 500),
  buildBaseEmpaque('BIG_BAG', 1000),
];

export const isDefaultConfiguracionEmpaque = (item: Pick<ConfiguracionEmpaque, 'id'>) =>
  item.id.startsWith(DEFAULT_ID_PREFIX);

const configuracionEmpaqueKey = (item: Pick<ConfiguracionEmpaque, 'tipo_empaque' | 'capacidad_kg'>) =>
  `${item.tipo_empaque}:${Number(item.capacidad_kg)}`;

export const mergeConfiguracionEmpaques = (rows: ConfiguracionEmpaque[]): ConfiguracionEmpaque[] => {
  const merged = new Map<string, ConfiguracionEmpaque>();

  for (const item of [...DEFAULT_CONFIGURACION_EMPAQUES, ...rows]) {
    const key = configuracionEmpaqueKey(item);
    const current = merged.get(key);

    if (!current) {
      merged.set(key, item);
      continue;
    }

    const currentIsDefault = isDefaultConfiguracionEmpaque(current);
    const itemIsDefault = isDefaultConfiguracionEmpaque(item);

    if (currentIsDefault && !itemIsDefault && item.esta_activo) {
      merged.set(key, item);
      continue;
    }

    if (!currentIsDefault && itemIsDefault) {
      continue;
    }

    if (item.esta_activo && !current.esta_activo) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values())
    .filter((item) => item.esta_activo)
    .sort((a, b) => {
      const typeOrder = a.tipo_empaque === b.tipo_empaque ? 0 : (a.tipo_empaque === 'BOLSA' ? -1 : 1);
      if (typeOrder !== 0) return typeOrder;
      return Number(a.capacidad_kg) - Number(b.capacidad_kg);
    });
};
