import { ApiService } from '../../../infrastructure/api/';
import type { StockMateriaPrima } from "../types";
import { assertPermission } from '../../auth/accessControl';
import { auditAction } from '../../auth/audit';
import type { Silo } from '../../silos/types';

export interface NewStockEntryData {
  id_insumo: string;
  nombre_insumo: string;
  id_proveedor: string;
  nombre_prov: string;
  ubicacion: string;
  lote: string;
  remito_nro: string;
  cantidad: number;
  unidad_entrada: 'KG' | 'TON';
  costo_unitario?: number;
  fecha_ingreso: string;
  cantidad_actual: number;
  cantidad_inicial: number;
}

export const stockMateriaPrimaService = {
  findAll: async (): Promise<StockMateriaPrima[]> => {
    return await ApiService.stockMP.getAllLotes();
  },

  create: async (data: NewStockEntryData): Promise<StockMateriaPrima> => {
    assertPermission('stock_mp', 'modify_stock');
    if (!data.lote?.trim()) throw new Error('El lote es obligatorio.');
    if (!data.id_proveedor) throw new Error('El proveedor es obligatorio.');
    if (!data.id_insumo) throw new Error('El insumo es obligatorio.');
    if (data.cantidad <= 0) throw new Error('La cantidad debe ser mayor a 0.');

    const lote = data.lote.trim().toUpperCase();
    const remito = data.remito_nro?.trim() ?? '';
    const silosService = (ApiService as typeof ApiService & { silos?: { getAll: () => Promise<Silo[]> } }).silos;
    if (silosService?.getAll) {
      const silos = await silosService.getAll();
      const siloSeleccionado = silos.find((silo) => silo.nombre === data.ubicacion.trim());
      if (!siloSeleccionado) {
        throw new Error('El silo seleccionado no existe.');
      }
      if (siloSeleccionado.tipo_uso !== 'MATERIA_PRIMA') {
        throw new Error('Solo se pueden ingresar materias primas en silos de Materia Prima.');
      }
    }

    const created = await ApiService.stockMP.create({
      id_insumo: data.id_insumo,
      id_proveedor: data.id_proveedor,
      lote,
      remito_nro: remito,
      cantidad: data.cantidad,
      unidad_entrada: data.unidad_entrada,
      costo_total: 0,
      costo_unitario: 0,
      // TODO: deuda técnica: reemplazar id fijo por sesión autenticada
      id_usuario: 'usr-101',
      fecha_ingreso: new Date(data.fecha_ingreso),
      ubicacion: data.ubicacion,
    });

    await auditAction({
      modulo: 'stock_mp',
      accion: 'modify_stock',
      entidad: 'stock_lote_mp',
      entidad_ref: created.uid,
      payload: {
        lote,
        cantidad: data.cantidad,
      },
    });
    return created;
  },

  update: async (uid: string, data: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> => {
    assertPermission('stock_mp', 'modify_stock');
    const updated = await ApiService.stockMP.update(uid, data);
    await auditAction({
      modulo: 'stock_mp',
      accion: 'modify_stock',
      entidad: 'stock_lote_mp',
      entidad_ref: uid,
      payload: data as Record<string, unknown>,
    });
    return updated;
  },

  delete: async (uid: string): Promise<void> => {
    assertPermission('stock_mp', 'modify_stock');
    await ApiService.stockMP.delete(uid);
    await auditAction({
      modulo: 'stock_mp',
      accion: 'modify_stock',
      entidad: 'stock_lote_mp',
      entidad_ref: uid,
    });
  }
};
