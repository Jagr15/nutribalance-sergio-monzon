export interface Ingrediente {
  id_insumo: string;
  nombre_insumo: string; // Útil para mostrar en la UI de creación
  porcentaje: number | '';
  aporte_proteina_pct?: number;
  aporte_proteina_g_kg?: number;
  costo_unitario_usado?: number;
  costo_contribucion_kg?: number;
  fuente_costo?: 'PROMEDIO_STOCK' | 'REFERENCIA' | 'SIN_COSTO';
}

export interface Formula {
  uid: string;
  nombre_producto: string;
  ingredientes: Ingrediente[];
  version: number;
  esta_activa: boolean;
  ultima_edicion: Date;
  id_usuario: string;
  author: string;
  createdAt:Date;
  proteina_calculada_pct?: number;
  costo_total?: number;
  costo_por_kg?: number;
  costo_por_tonelada?: number;
  advertencias_nutricionales?: string[];
  advertencias_costos?: string[];

}
