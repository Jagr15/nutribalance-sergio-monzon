// src/features/proveedores/hooks/useProveedores.ts
import { useState, useCallback } from 'react';
import { proveedorService } from '../services/proveedorService';
import type { Proveedor } from '../types/proveedor';

export const useProveedores = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await proveedorService.findAll();
      // Mostramos solo los activos en la lista principal
      setProveedores(data.filter((p: Proveedor) => p.esta_activo));
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
      setLoadError("No se pudo cargar el directorio de proveedores.");
      setProveedores([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = async (data: Omit<Proveedor, 'uid' | 'esta_activo'>) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nuevo = await proveedorService.create(data);
      setProveedores(prev => [...prev, nuevo]);
      return nuevo;
    } catch (error) {
      console.error("Error al crear proveedor:", error);
      setLoadError("No se pudo crear el proveedor.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const update = async (uid: string, data: Partial<Proveedor>) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const actualizado = await proveedorService.update(uid, data);
      setProveedores(prev => prev.map(p => p.uid === uid ? actualizado : p));
      return actualizado;
    } catch (error) {
      console.error("Error al actualizar proveedor:", error);
      setLoadError("No se pudo actualizar el proveedor.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const remove = async (uid: string) => {
    setLoadError(null);
    try {
      await proveedorService.delete(uid);
      setProveedores(prev => prev.filter(p => p.uid !== uid));
      return true;
    } catch (error) {
      console.error("Error al desactivar proveedor:", error);
      setLoadError("No se pudo desactivar el proveedor.");
      return false;
    }
  };

  return { proveedores, isLoading, getAll, create, update, remove, loadError };
};
