export interface Ingrediente {
  id_insumo: string;
  nombre_insumo: string; // Útil para mostrar en la UI de creación
  porcentaje: number;
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

}