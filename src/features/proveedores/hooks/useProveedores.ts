// src/features/proveedores/hooks/useProveedores.ts
import { useState, useCallback } from 'react';
import { proveedorService } from '../services/proveedorService';
import type { Proveedor } from '../types/proveedor';

export const useProveedores = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await proveedorService.findAll();
      // Mostramos solo los activos en la lista principal
      setProveedores(data.filter(p => p.esta_activo));
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = async (data: Omit<Proveedor, 'uid' | 'esta_activo'>) => {
    setIsLoading(true);
    try {
      const nuevo = await proveedorService.create(data);
      setProveedores(prev => [...prev, nuevo]);
      return nuevo;
    } finally {
      setIsLoading(false);
    }
  };

  const update = async (uid: string, data: Partial<Proveedor>) => {
    setIsLoading(true);
    try {
      const actualizado = await proveedorService.update(uid, data);
      setProveedores(prev => prev.map(p => p.uid === uid ? actualizado : p));
      return actualizado;
    } finally {
      setIsLoading(false);
    }
  };

  const remove = async (uid: string) => {
    try {
      await proveedorService.delete(uid);
      setProveedores(prev => prev.filter(p => p.uid !== uid));
      return true;
    } catch (error) {
      return false;
    }
  };

  return { proveedores, isLoading, getAll, create, update, remove };
};