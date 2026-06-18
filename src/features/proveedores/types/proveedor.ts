
export interface Proveedor {
    uid: string;
    nombre_empresa: string;
    producto_que_provee?: string | null;
    contacto_nombre: string;
    telefono: string;
    email: string;
    direccion: string;
    documento?: string; // Dato fiscal necesario en Argentina
    esta_activo: boolean;
  }
