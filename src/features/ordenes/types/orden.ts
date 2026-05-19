import type { TipoUnidad } from "../../../shared/types/global.interface";

export const EstadoOrden = {
  PENDIENTE: "PENDIENTE",
  EN_PROCESO: "EN PROCESO",
  FINALIZADO: "FINALIZADO",
  ANULADO: "ANULADO",
} as const;
export type EstadoOrden = (typeof EstadoOrden)[keyof typeof EstadoOrden];


export interface DetalleInsumoLote {
  id_lote: string;      
  id_insumo: string;    
  nombre_insumo: string;
  cantidad_usada: number; 
  tipo_unidad: TipoUnidad;
  costo_unitario: number; 
  costo_total: number; // (cantidad_usada * costo_unitario)
}
export interface OrdenProduccion {
  id: string;
  lote: string; 
  id_formula: string;
  nombre_producto: string;
  version_formula: number;
  cantidad_objetivo: number;
  cantidad_real?: number;
  merma_manual?: number;
  estado: EstadoOrden;
  fecha_creacion: string;
  usuario_responsable: string;
  id_silo: string | null;
  destino_silo: string | null;
  
  // EL HISTORIAL DE TRAZABILIDAD
  detalle_insumos: DetalleInsumoLote[]; 
  costo_total_insumos: number; // Suma de (cantidad_usada * costo_unitario)
}
