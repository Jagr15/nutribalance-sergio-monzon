
export interface Proveedor {
    uid: string;
    nombre_empresa: string;
    producto_que_provee?: string | null;
    contacto_nombre: string;
    telefono: string;
    email?: string | null;
    direccion: string;
    documento?: string | null; // Dato fiscal opcional en desarrollo
    esta_activo: boolean;
  }
