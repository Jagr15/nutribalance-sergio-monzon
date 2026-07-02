import type { Cliente, ClienteCreatePayload, ClienteEstadoCuentaItem, ClienteUpdatePayload } from '../../../../features/clientes/types/cliente';
import { mockApiCall } from '../mockClient';
import { getMockCuentaCorrienteRows } from './mockStockPTService';

let mockClientes: Cliente[] = [
  {
    uid: 'cli-001',
    nombre: 'Estancia La Esperanza',
    segmento: 'Tambo',
    ubicacion: 'Rafaela, Santa Fe',
    contacto: 'Marina Gómez · +54 3492 445112',
    productoPrincipal: 'Alimento Lechera',
    condicionComercial: '30 días fecha factura',
    estado: 'Activo',
    observaciones: 'Cliente estable con compras quincenales.',
    ultimaCompra: '2026-05-15',
    saldoPendienteArs: 325000,
    estaActivo: true,
  },
  {
    uid: 'cli-002',
    nombre: 'Agropecuaria Don Sergio',
    segmento: 'Mixto agrícola-ganadero',
    ubicacion: 'Pergamino, Buenos Aires',
    contacto: 'Julián Díaz · +54 2477 518223',
    productoPrincipal: 'Ración Recría/Engorde',
    condicionComercial: '21 días',
    estado: 'En riesgo',
    observaciones: 'Cliente con tensión de cobranzas.',
    ultimaCompra: '2026-05-08',
    saldoPendienteArs: 1185000,
    estaActivo: true,
  },
  {
    uid: 'cli-003',
    nombre: 'Tambo San Miguel',
    segmento: 'Tambo',
    ubicacion: 'Villa María, Córdoba',
    contacto: 'Natalia Ferreyra · +54 353 4869012',
    productoPrincipal: 'Alimento Lechera',
    condicionComercial: 'Contado contra entrega',
    estado: 'Activo',
    observaciones: 'Cuenta saneada.',
    ultimaCompra: '2026-05-17',
    saldoPendienteArs: 0,
    estaActivo: true,
  },
];

const getClienteFinancialSummary = (clienteId: string) => {
  const rows = getMockCuentaCorrienteRows().filter((row) => row.cliente_id === clienteId);
  if (rows.length === 0) {
    return null;
  }

  const saldoPendienteArs = rows.reduce((acc, row) => acc + Number(row.saldo ?? 0), 0);
  const latest = rows.reduce<{ score: number; value: string | null } | null>((current, row) => {
    const score = new Date(row.fecha).getTime();
    if (!Number.isFinite(score)) return current;
    if (!current || score > current.score) {
      return { score, value: row.fecha };
    }
    return current;
  }, null);

  return {
    saldoPendienteArs,
    ultimaCompra: latest?.value ? latest.value.slice(0, 10) : null,
  };
};

export const mockClienteService = {
  getAll: async (): Promise<Cliente[]> => {
    const rows = mockClientes.map((cliente) => {
      const summary = getClienteFinancialSummary(cliente.uid);
      if (!summary) return cliente;
      return {
        ...cliente,
        saldoPendienteArs: summary.saldoPendienteArs,
        ultimaCompra: summary.ultimaCompra ?? undefined,
      };
    });

    return mockApiCall(rows);
  },

  getById: async (uid: string): Promise<Cliente | undefined> => mockApiCall(mockClientes.find((cliente) => cliente.uid === uid)),

  getEstadoCuentaCliente: async (clienteId: string): Promise<ClienteEstadoCuentaItem[]> => {
    const rows = (await getMockCuentaCorrienteRows())
      .filter((row) => row.cliente_id === clienteId)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .map(({ cliente_id: _clienteId, ...row }) => row);

    return mockApiCall(rows);
  },

  create: async (data: ClienteCreatePayload): Promise<Cliente> => {
    const nuevo: Cliente = {
      ...data,
      uid: `cli-${Math.floor(Math.random() * 1000000)}`,
    };
    mockClientes = [nuevo, ...mockClientes];
    return mockApiCall(nuevo);
  },

  update: async (uid: string, data: ClienteUpdatePayload): Promise<Cliente> => {
    const updated = mockClientes.find((cliente) => cliente.uid === uid);
    if (!updated) throw new Error(`Cliente con UID ${uid} no encontrado`);

    const nextCliente = { ...updated, ...data };
    mockClientes = mockClientes.map((cliente) => (cliente.uid === uid ? nextCliente : cliente));
    return mockApiCall(nextCliente);
  },

  delete: async (uid: string): Promise<boolean> => {
    mockClientes = mockClientes.map((cliente) =>
      cliente.uid === uid ? { ...cliente, estaActivo: false, estado: 'Suspendido' } : cliente
    );
    return mockApiCall(true);
  },
};
