import type {
  ActualizarConfiguracionEmpaquePayload,
  ConfiguracionEmpaque,
  CrearConfiguracionEmpaquePayload,
} from '../../../../features/productos/types/configuracionEmpaque';

const now = () => new Date().toISOString();

const seed: ConfiguracionEmpaque[] = [
  { id: crypto.randomUUID(), producto_id: null, tipo_empaque: 'BOLSA', capacidad_kg: 15, esta_activo: true, activo: true, created_at: now(), updated_at: now() },
  { id: crypto.randomUUID(), producto_id: null, tipo_empaque: 'BOLSA', capacidad_kg: 20, esta_activo: true, activo: true, created_at: now(), updated_at: now() },
  { id: crypto.randomUUID(), producto_id: null, tipo_empaque: 'BOLSA', capacidad_kg: 25, esta_activo: true, activo: true, created_at: now(), updated_at: now() },
  { id: crypto.randomUUID(), producto_id: null, tipo_empaque: 'BOLSA', capacidad_kg: 40, esta_activo: true, activo: true, created_at: now(), updated_at: now() },
  { id: crypto.randomUUID(), producto_id: null, tipo_empaque: 'BIG_BAG', capacidad_kg: 500, esta_activo: true, activo: true, created_at: now(), updated_at: now() },
  { id: crypto.randomUUID(), producto_id: null, tipo_empaque: 'BIG_BAG', capacidad_kg: 1000, esta_activo: true, activo: true, created_at: now(), updated_at: now() },
];

let db: ConfiguracionEmpaque[] = [...seed];

const normalize = (row: ConfiguracionEmpaque): ConfiguracionEmpaque => ({
  ...row,
  producto_id: row.producto_id ?? null,
  esta_activo: Boolean(row.esta_activo),
  activo: Boolean(row.activo ?? row.esta_activo),
});

const mapInsert = (payload: CrearConfiguracionEmpaquePayload): ConfiguracionEmpaque => ({
  id: crypto.randomUUID(),
  producto_id: payload.producto_id ?? null,
  tipo_empaque: payload.tipo_empaque,
  capacidad_kg: payload.capacidad_kg,
  esta_activo: true,
  activo: true,
  created_at: now(),
  updated_at: now(),
});

const ensureValidCapacity = (payload: CrearConfiguracionEmpaquePayload) => {
  const bolsa = payload.tipo_empaque === 'BOLSA' && [15, 20, 25, 40].includes(payload.capacidad_kg);
  const bigBag = payload.tipo_empaque === 'BIG_BAG' && [500, 1000].includes(payload.capacidad_kg);
  if (!bolsa && !bigBag) {
    throw new Error('La capacidad no es válida para el tipo de empaque.');
  }
};

export const mockConfiguracionEmpaquesService = {
  getAll: async (): Promise<ConfiguracionEmpaque[]> => db.map(normalize),
  listByProducto: async (_productoId: string): Promise<ConfiguracionEmpaque[]> => db.map(normalize),
  create: async (data: CrearConfiguracionEmpaquePayload): Promise<ConfiguracionEmpaque> => {
    ensureValidCapacity(data);
    const duplicateActive = db.some(
      (item) =>
        item.esta_activo &&
        item.tipo_empaque === data.tipo_empaque &&
        Number(item.capacidad_kg) === Number(data.capacidad_kg),
    );
    if (duplicateActive) {
      throw new Error('Ya existe una configuración activa con esa capacidad.');
    }

    const row = mapInsert(data);
    db = [row, ...db];
    return normalize(row);
  },
  update: async (id: string, data: ActualizarConfiguracionEmpaquePayload): Promise<ConfiguracionEmpaque> => {
    const index = db.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró la configuración de empaque.');
    const current = db[index]!;
    const updated: ConfiguracionEmpaque = normalize({
      ...current,
      ...data,
      id: current.id,
      tipo_empaque: (data.tipo_empaque ?? current.tipo_empaque) as ConfiguracionEmpaque['tipo_empaque'],
      capacidad_kg: (data.capacidad_kg ?? current.capacidad_kg) as ConfiguracionEmpaque['capacidad_kg'],
      esta_activo: data.esta_activo ?? current.esta_activo,
      activo: data.esta_activo ?? current.activo ?? current.esta_activo,
      updated_at: now(),
    });
    db[index] = updated;
    return updated;
  },
  toggleActive: async (id: string, esta_activo: boolean): Promise<ConfiguracionEmpaque> => {
    const index = db.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró la configuración de empaque.');
    const updated: ConfiguracionEmpaque = normalize({
      ...db[index]!,
      esta_activo,
      activo: esta_activo,
      updated_at: now(),
    });
    db[index] = updated;
    return updated;
  },
};
