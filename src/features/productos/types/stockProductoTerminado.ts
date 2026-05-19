import type { TipoUnidad } from "../../../shared/types/global.interface";

export interface StockProductoTerminado {
    uid: string;
    id_orden: string;
    numero_orden:string;
    nombre_producto: string; // Desnormalizado para evitar lookups constantes
    cantidad_total: number;
    lote: string;
    unidad_medida: TipoUnidad;
    estado: ControlEstado; // Para las alertas en rojo que pidió Sergio
    id_silo: string;
    nombre_silo: string;
    detalle_insumos: detalle_insumos;
    fecha_ingreso: string;
    usuario: string;
    
    updateAt: string;

  
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
