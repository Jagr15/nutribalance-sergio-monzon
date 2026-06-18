
export const Role = {
  SUPERADMIN: "SUPERADMIN",
  ADMIN: "ADMIN",
  ENCARGADO: "ENCARGADO",
  OPERARIO: "OPERARIO",
  FINANZAS: "FINANZAS",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export interface Usuario {
  uid: string;
  username: string;
  nombre_completo: string;
  email: string;
  role: Role;
  esta_activo: boolean;
  fecha_creacion?: string;
}
