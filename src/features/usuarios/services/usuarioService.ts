import { ApiService } from '../../../infrastructure/api';
import type { Usuario } from '../types/usuario';

export interface UsuarioWritePayload extends Omit<Usuario, 'uid'> {
  password?: string;
  confirmPassword?: string;
}

export const usuarioService = {
  findAll: (): Promise<Usuario[]> => {
    return ApiService.usuarios.getAll();
  },

  findById: (uid: string): Promise<Usuario | undefined> => {
    return ApiService.usuarios.getById(uid);
  },

  create: (data: UsuarioWritePayload): Promise<Usuario> => {
    return ApiService.usuarios.create(data);
  },

  update: (uid: string, data: Partial<UsuarioWritePayload>): Promise<Usuario> => {
    return ApiService.usuarios.update(uid, data);
  },

  delete: (uid: string): Promise<boolean> => {
    return ApiService.usuarios.delete(uid);
  }
};
