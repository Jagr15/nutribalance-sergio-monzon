import type { Proveedor } from '../../../../features/proveedores/types/proveedor';
import suppliersData from '../data/proveedores.json';
import { mockApiCall } from '../mockClient';
import { mockMateriaPrimaService } from './mockMateriaPrimaService';

// Simulación de base de datos en memoria
let mockSuppliers: Proveedor[] = [...suppliersData] as Proveedor[];

export const mockProveedorService = {
  getAll: async (): Promise<Proveedor[]> => {
    return mockApiCall(mockSuppliers.filter((s: any) => !s.deletedAt));
  },

  getById: async (uid: string): Promise<Proveedor | undefined> => {
    const supplier = mockSuppliers.find((s: any) => s.uid === uid && !s.deletedAt);
    return mockApiCall(supplier);
  },

  create: async (data: Omit<Proveedor, 'uid'>): Promise<Proveedor> => {
    const newSupplier: Proveedor = {
      ...data,
      uid: `p-${Math.floor(Math.random() * 10000)}`,
      esta_activo: true,
    };
    mockSuppliers = [...mockSuppliers, newSupplier];
    return mockApiCall(newSupplier);
  },

  update: async (uid: string, data: Partial<Proveedor>): Promise<Proveedor> => {
    mockSuppliers = mockSuppliers.map((s) =>
      s.uid === uid ? { ...s, ...data } : s
    );
    const updatedSupplier = mockSuppliers.find((s) => s.uid === uid)!;
    return mockApiCall(updatedSupplier);
  },

  delete: async (uid: string): Promise<boolean> => {
    const lots = await mockMateriaPrimaService.getAllLotes();
    const hasLots = lots.some(l => l.id_proveedor === uid);
    if (hasLots) {
      throw new Error('No se puede eliminar el proveedor porque tiene lotes de materia prima asociados.');
    }

    mockSuppliers = mockSuppliers.map((s) =>
      s.uid === uid ? { ...s, esta_activo: false, deletedAt: new Date().toISOString() } : s
    );
    return mockApiCall(true);
  },

  toggleActive: async (uid: string, activo: boolean): Promise<Proveedor> => {
    mockSuppliers = mockSuppliers.map((s) =>
      s.uid === uid ? { ...s, esta_activo: activo, deletedAt: activo ? undefined : new Date().toISOString() } : s
    );
    const updatedSupplier = mockSuppliers.find((s) => s.uid === uid)!;
    return mockApiCall(updatedSupplier);
  },
};
