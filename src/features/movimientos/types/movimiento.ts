export enum TipoMovimiento {
    ENTRADA = "ENTRADA",
    SALIDA = "SALIDA",
    AJUSTE = "AJUSTE"
}

export enum OrigenMovimiento {
    COMPRA = "COMPRA",
    PRODUCCION = "PRODUCCION",
    VENTA = "VENTA",
    MERMA = "MERMA"
}

export interface Movimiento {
  uid: string;
  fecha: Date;
  id_usuario: string; // Quién hizo la acción
  tipo: TipoMovimiento;
  origen: OrigenMovimiento;
  id_entidad: string; // ID del Insumo o del Producto Terminado
  nombre_entidad: string; // Ej: "Maíz" o "Pellet Cerdo"
  cantidad: number; // Positivo para entradas, negativo para salidas
  lote_afectado: string; // Para saber exactamente qué lote se movió
  observaciones?: string;
}