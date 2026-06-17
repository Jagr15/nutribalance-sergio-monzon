import type { DetalleInsumoLote } from "../../ordenes/types";
import type { TipoUnidad } from "../../../shared/types/global.interface";

export interface StockProductoTerminado {
    uid: string;
    id_orden: string;
    numero_orden:string;
    id_formula?: string | null;
    version_formula?: number | null;
    nombre_producto: string; // Desnormalizado para evitar lookups constantes
    cantidad_total: number;
    cantidad_inicial?: number | null;
    costo_unitario_estimado?: number | null;
    lote: string;
    unidad_medida: TipoUnidad;
    estado: ControlEstado; // Para las alertas en rojo que pidió Sergio
    id_silo: string;
    nombre_silo: string;
    detalle_insumos: detalle_insumos | detalle_insumos[] | DetalleInsumoLote[];
    fecha_ingreso: string;
    usuario: string;
    
    updateAt: string;

  
  }

export type TipoMovimientoStockPT = 'INGRESO' | 'SALIDA' | 'AJUSTE';

export interface MovimientoStockPT {
  id: string;
  stock_pt_id: string | null;
  producto_id: string | null;
  nombre_producto: string;
  lote: string;
  numero_orden: string | null;
  silo: string | null;
  tipo: TipoMovimientoStockPT;
  cantidad: number;
  unidad: TipoUnidad;
  costo_unitario?: number | null;
  valor_total?: number | null;
  motivo?: string | null;
  referencia?: string | null;
  created_at: string;
}

export interface RegistrarSalidaStockPTData {
  stock_pt_id: string;
  cantidad: number;
  motivo: string;
  referencia?: string;
}

export interface StockProductoTerminadoResumen {
  producto_id: string | null;
  nombre_producto: string;
  unidad: TipoUnidad;
  stock_actual: number;
  valor_monetario: number;
  estado: ControlEstado;
  cantidad_lotes: number;
  ultima_actualizacion: string;
  numero_orden?: string | null;
  id_formula?: string | null;
  version_formula?: number | null;
}
  export interface detalle_clientes{
    id_cliente: string;
    nombre: string;
    factura: string;
    cantidad: string;
    unidad_medida: TipoUnidad;
  }

  export interface detalle_insumos {
    id_lote: string;
    nombre_lote: string;
    id_insumo: string;
    nombre_insumo: string;
    cantidad: number;
    unidad_medida: TipoUnidad;
  }

export const ControlEstado = {
  OK: "OK",
  BAJO: "BAJO",
  CRITICO: "CRITICO",
} as const;
export type ControlEstado = (typeof ControlEstado)[keyof typeof ControlEstado];
