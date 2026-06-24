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
    proteina_bruta_pct?: number;
    humedad_pct?: number;
    fibra_pct?: number;
    grasa_pct?: number;
    cenizas_pct?: number;
    unidad_base?: TipoUnidad;
    observaciones?: string;
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
    insumo_id?: string;
    id_insumo: string;
    nombre_insumo?: string;
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

export type StockMPEstadoResumen = 'CRITICO' | 'BAJO' | 'OK';

export interface StockMateriaPrimaResumen {
  insumo_id: string;
  nombre_insumo: string;
  unidad: string;
  stock_actual: number;
  stock_comprometido: number;
  stock_disponible: number;
  umbral_alerta: number;
  estado: StockMPEstadoResumen;
}

export interface HistorialCompraMP {
  proveedor: string;
  id_proveedor: string;
  insumo: string;
  id_insumo: string;
  fecha_compra: string;
  lote: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
}

export interface UltimoPrecioPagadoInsumo {
  insumo: string;
  id_insumo: string;
  ultimo_proveedor: string;
  id_proveedor: string;
  fecha_ultima_compra: string;
  ultimo_precio: number;
  precio_compra_anterior: number | null;
  variacion_absoluta: number | null;
  variacion_pct: number | null;
}
