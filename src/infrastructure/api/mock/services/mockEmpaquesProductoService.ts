import type { ActualizarEmpaqueProductoPayload, CrearEmpaqueProductoPayload, EmpaqueProducto } from '../../../../features/productos/types';

let db: EmpaqueProducto[] = [];

export const mockEmpaquesProductoService = {
  listByProducto: async (productoId: string): Promise<EmpaqueProducto[]> => db.filter((item) => item.producto_id === productoId),
  create: async (data: CrearEmpaqueProductoPayload): Promise<EmpaqueProducto> => {
    const row: EmpaqueProducto = { id: crypto.randomUUID(), activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...data };
    db = [row, ...db];
    return row;
  },
  update: async (id: string, data: ActualizarEmpaqueProductoPayload): Promise<EmpaqueProducto> => {
    const index = db.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró el empaque.');
    db[index] = { ...db[index], ...data, updated_at: new Date().toISOString() };
    return db[index];
  },
  toggleActive: async (id: string, activo: boolean): Promise<EmpaqueProducto> => {
    const index = db.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('No se encontró el empaque.');
    db[index] = { ...db[index], activo, updated_at: new Date().toISOString() };
    return db[index];
  },
};
