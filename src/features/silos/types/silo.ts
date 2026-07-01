export interface Silo {
    uid: string,
    nombre: string,
    descripcion: string
    tipo_uso: 'MATERIA_PRIMA' | 'PRODUCTO_TERMINADO',
    esta_activo?: boolean,
    stock_actual_ton?: number
}
