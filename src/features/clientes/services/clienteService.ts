import { ApiService } from '../../../infrastructure/api';
import type { Cliente, ClienteCreatePayload, ClienteUpdatePayload } from '../types/cliente';

export const clienteService = {
  findAll: (): Promise<Cliente[]> => ApiService.clientes.getAll(),

  findById: (uid: string): Promise<Cliente | undefined> => ApiService.clientes.getById(uid),

  create: (data: ClienteCreatePayload): Promise<Cliente> => ApiService.clientes.create(data),

  update: (uid: string, data: ClienteUpdatePayload): Promise<Cliente> => ApiService.clientes.update(uid, data),

  delete: (uid: string): Promise<boolean> => ApiService.clientes.delete(uid),
};
