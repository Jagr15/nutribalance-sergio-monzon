import type{ Usuario } from '../../../../features/usuarios/types/usuario';
import usersData from '../data/usuarios.json';
import { mockApiCall } from '../mockClient';

// Simulación de base de datos en memoria usando la interfaz en español
let mockUsers: Usuario[] = [...usersData] as Usuario[];

export const mockUsuarioService = {
  getAll: async (): Promise<Usuario[]> => {
    return mockApiCall(mockUsers);
  },

  getById: async (uid: string): Promise<Usuario | undefined> => {
    const user = mockUsers.find((u) => u.uid === uid);
    return mockApiCall(user);
  },

  create: async (data: Omit<Usuario, 'uid'>): Promise<Usuario> => {
    const newUser: Usuario = {
      ...data,
      uid: `u-${Math.floor(Math.random() * 10000)}`,
      esta_activo: true, 
    };
    mockUsers = [...mockUsers, newUser];
    return mockApiCall(newUser);
  },

  update: async (uid: string, data: Partial<Usuario>): Promise<Usuario> => {
    mockUsers = mockUsers.map((u) => (u.uid === uid ? { ...u, ...data } : u));
    const updatedUser = mockUsers.find((u) => u.uid === uid)!;
    return mockApiCall(updatedUser);
  },

  delete: async (uid: string): Promise<boolean> => {
    mockUsers = mockUsers.map((u) =>
      u.uid === uid ? { ...u, esta_activo: false } : u
    );
    return mockApiCall(true);
  },
};