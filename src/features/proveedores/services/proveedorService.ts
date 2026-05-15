// src/features/proveedores/services/proveedorService.ts
import { ApiService } from '../../../infrastructure/api/';
import type { Proveedor } from '../types/proveedor';

export const proveedorService = {
  findAll: () => ApiService.proveedores.getAll(),
  
  findById: (uid: string) => ApiService.proveedores.getById(uid),
  
  create: (data: Omit<Proveedor, 'uid' | 'esta_activo'>) => 
  ApiService.proveedores.create(data as Omit<Proveedor, 'uid'>),
  
  update: (uid: string, data: Partial<Proveedor>) => 
  ApiService.proveedores.update(uid, data),
  
  delete: (uid: string) => 
  ApiService.proveedores.delete(uid)
};