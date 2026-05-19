import type { TipoUnidad } from "../../../shared/types/global.interface";

export const TipoCategoria = {
  Grano: "Grano",
  Suplemento: "Suplemento",
  Aditivo: "Aditivo",
} as const;
export type TipoCategoria = (typeof TipoCategoria)[keyof typeof TipoCategoria];
export interface Insumo {
    uid: string;
    nombre: string; // Ej: "Maíz"
    unidad_medida: TipoUnidad;
    umbral_alerta: number; // El usuario define que a los 500kg se ponga rojo
    ref_costo_unitario?:number;
    categoria: TipoCategoria;
  }

  export interface OperacionLote {
    fecha: Date;
    cantidad: number;
    destino: string;       // Ej: "Línea de Producción A", "Mezcladora 1"
    id_operacion: string;   // ID interno de la base de datos (para links)
    nro_operacion: string;  // El número de negocio: "OP-20215", "TR-5502"
    operacion?: string;      // Nombre descriptivo: "CONSUMO PRODUCCIÓN", "AJUSTE", "TRANSFERENCIA"
  }

  export interface StockEnTransito {
    id_orden: string;
    nro_operacion: string;
    cantidad: number;

  }

  export interface StockMateriaPrima {
    uid: string;
    id_insumo: string;
    id_proveedor: string;
    lote: string;
    cantidad_actual: number; 
    cantidad_inicial: number;
    cantidad_comprometida?: number;
    costo_unitario: number;
    costo_total:number;
    fecha_ingreso: Date; // Fecha del documento (Remito/Factura)
    remito_nro: string;
    ubicacion: string;
    operaciones?: OperacionLote;
    stock_transito?: StockEnTransito;
    id_usuario: string;  
    createdAt: Date;     
    updatedAt: Date;    
}
