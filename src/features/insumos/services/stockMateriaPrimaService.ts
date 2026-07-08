import { ApiService } from '../../../infrastructure/api/';
import type { StockMateriaPrima } from "../types";
import { assertPermission } from '../../auth/accessControl';
import { auditAction } from '../../auth/audit';
import type { Silo } from '../../silos/types';
import { resolverCostoIngresoMP } from '../utils/costoIngreso';
import { contabilidadOperativaService } from '../../finanzas/services/contabilidadOperativaService';

const parseLocalDateForBusinessDay = (value: string) => {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(value);
  }

  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
};

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
  origen?: 'COMPRA' | 'AJUSTE' | 'CARGA_INICIAL' | 'CORRECCION' | 'ALTA_INSUMO';
  tipoOperacion?: 'COMPRA' | 'AJUSTE' | 'CARGA_INICIAL' | 'CORRECCION' | 'ALTA_INSUMO';
  registrarCompraFinanciera?: boolean;
  condicion_pago?: string;
}

const shouldRegisterFinancialPurchase = (data: NewStockEntryData) => {
  return data.registrarCompraFinanciera === true;
};

export const stockMateriaPrimaService = {
  findAll: async (): Promise<StockMateriaPrima[]> => {
    return await ApiService.stockMP.getAllLotes();
  },

  create: async (data: NewStockEntryData): Promise<StockMateriaPrima> => {
    assertPermission('stock_mp', 'modify_stock');
    const shouldRegisterPurchase = shouldRegisterFinancialPurchase(data);
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

    let insumoSeleccionado: { costo_por_kg?: number | null; ref_costo_unitario?: number | null; costo?: number | null } | null = null;
    try {
      const insumos = await ApiService.insumos.getAllInsumos();
      const encontrado = insumos.find((item) => item.uid === data.id_insumo);
      if (encontrado) {
        insumoSeleccionado = {
          costo_por_kg: encontrado.costo_por_kg ?? null,
          ref_costo_unitario: encontrado.ref_costo_unitario ?? null,
          costo: encontrado.costo ?? null,
        };
      }
    } catch (error) {
      console.warn('No se pudo resolver el costo de referencia del insumo.', error);
    }

    const costoResuelto = resolverCostoIngresoMP({
      cantidad: data.cantidad,
      unidad_entrada: data.unidad_entrada,
      costo_unitario: data.costo_unitario ?? null,
      costo_por_kg: insumoSeleccionado?.costo_por_kg ?? null,
      ref_costo_unitario: insumoSeleccionado?.ref_costo_unitario ?? null,
      costo: insumoSeleccionado?.costo ?? null,
    });

    const created = await ApiService.stockMP.create({
      id_insumo: data.id_insumo,
      id_proveedor: data.id_proveedor,
      lote,
      remito_nro: remito,
      cantidad: costoResuelto.cantidad_kg,
      unidad_entrada: data.unidad_entrada,
      costo_total: costoResuelto.costo_total,
      costo_unitario: costoResuelto.costo_unitario,
      // TODO: deuda técnica: reemplazar id fijo por sesión autenticada
      id_usuario: 'usr-101',
      fecha_ingreso: parseLocalDateForBusinessDay(data.fecha_ingreso),
      ubicacion: data.ubicacion,
    });

    if (shouldRegisterPurchase) {
      try {
        await contabilidadOperativaService.registrarCompraMateriaPrima({
          stock_lote_legacy_uid: created.uid,
          fecha: data.fecha_ingreso,
          lote: lote,
          insumo: data.nombre_insumo,
          proveedor: data.nombre_prov,
          monto: costoResuelto.costo_total,
          remito: remito || undefined,
          condicion_pago: data.condicion_pago?.trim() || undefined,
        });
      } catch (contabilidadError) {
        console.warn('No se pudo registrar la compra en contabilidad operativa.', contabilidadError);
      }
    }

    await auditAction({
      modulo: 'stock_mp',
      accion: 'modify_stock',
      entidad: 'stock_lote_mp',
      entidad_ref: created.uid,
      payload: {
        lote,
        cantidad: costoResuelto.cantidad_kg,
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
