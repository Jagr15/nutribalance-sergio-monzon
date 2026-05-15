
export interface Usuario {
    uid: string;
    username: string;
    nombre_completo: string;
    email: string;
    role: Role; // Controla qué botones ve en React
    esta_activo: boolean;
    fecha_creacion: Date;
  }

enum Role {
    SUPERADMIN ="SUPERADMIN",
    ENCARGADO ="ENCARGADO",
    OPERARIO="OPERARIO"
}