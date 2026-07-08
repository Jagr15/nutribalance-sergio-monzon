import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';
const isMockMode = () => runtimeConfig.mode === 'mock';

export interface Comprobante {
  id: string;
  legacy_uid?: string | null;
  tipo: 'FACTURA_COMPRA' | 'FACTURA_VENTA' | 'RECIBO' | 'PAGO' | 'AJUSTE';
  numero: string | null;
  fecha_emision: string;
  fecha_vencimiento?: string | null;
  tercero: string | null;
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'ANULADO';
  total: number;
  saldo: number;
  cliente_id?: string | null;
  proveedor_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Memory database for mock mode
let mockComprobantes: Comprobante[] = [];

const getMockComprobantes = async (): Promise<Comprobante[]> => {
  if (mockComprobantes.length === 0) {
    mockComprobantes = [
      {
        id: 'comp-1',
        legacy_uid: 'comp-1',
        tipo: 'FACTURA_VENTA',
        numero: 'FC-A-0001-00002130',
        fecha_emision: '2026-07-01',
        fecha_vencimiento: '2026-08-01',
        tercero: 'Distribuidora Agro Sur',
        estado: 'PENDIENTE',
        total: 1250000,
        saldo: 1250000,
        cliente_id: 'cli-001',
      },
      {
        id: 'comp-2',
        legacy_uid: 'comp-2',
        tipo: 'FACTURA_VENTA',
        numero: 'FC-A-0001-00002131',
        fecha_emision: '2026-07-02',
        fecha_vencimiento: '2026-08-02',
        tercero: 'Agroganadera del Litoral',
        estado: 'PAGADO',
        total: 850000,
        saldo: 0,
        cliente_id: 'cli-002',
      },
      {
        id: 'comp-3',
        legacy_uid: 'comp-3',
        tipo: 'FACTURA_COMPRA',
        numero: 'FC-C-0002-00010488',
        fecha_emision: '2026-07-03',
        fecha_vencimiento: '2026-07-30',
        tercero: 'Insumos Pampeanos S.A.',
        estado: 'PENDIENTE',
        total: 3500000,
        saldo: 3500000,
        proveedor_id: 'prov-001',
      }
    ];
  }
  return mockComprobantes;
};

export const comprobanteService = {
  getAll: async (): Promise<Comprobante[]> => {
    if (isMockMode()) {
      return getMockComprobantes();
    }

    const { data, error } = await supabaseClient
      .from('comprobantes')
      .select('*')
      .is('deleted_at', null)
      .order('fecha_emision', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      ...row,
      total: Number(row.total),
      saldo: Number(row.saldo),
    }));
  },

  create: async (data: Omit<Comprobante, 'id' | 'created_at' | 'updated_at'>): Promise<Comprobante> => {
    if (isMockMode()) {
      const nuevo: Comprobante = {
        ...data,
        id: `comp-mock-${Math.floor(Math.random() * 1000000)}`,
        legacy_uid: `comp-mock-${Math.floor(Math.random() * 1000000)}`,
      };
      mockComprobantes = [nuevo, ...mockComprobantes];

      // Update client's balance in mockClienteService if it's a sales invoice
      if (data.tipo === 'FACTURA_VENTA' && data.cliente_id && data.saldo > 0) {
        try {
          const { getMockClientesLocal, setMockClientesLocal } = await import('../../../infrastructure/api/mock/services/mockClienteService');
          const clients = getMockClientesLocal();
          const nextClients = clients.map(c => 
            c.uid === data.cliente_id 
              ? { ...c, saldoPendienteArs: Number((c.saldoPendienteArs + data.saldo).toFixed(2)) } 
              : c
          );
          setMockClientesLocal(nextClients);
        } catch {
          // ignore
        }
      }

      return nuevo;
    }

    const { data: inserted, error } = await supabaseClient
      .from('comprobantes')
      .insert({
        ...data,
        legacy_uid: `comp-manual-${Math.floor(Math.random() * 1000000)}`,
      })
      .select('*')
      .single();

    if (error) throw error;
    return {
      ...inserted,
      total: Number(inserted.total),
      saldo: Number(inserted.saldo),
    };
  },

  anular: async (id: string): Promise<void> => {
    if (isMockMode()) {
      const target = mockComprobantes.find(c => c.id === id || c.legacy_uid === id);
      if (target && target.tipo === 'FACTURA_VENTA' && target.cliente_id && target.saldo > 0) {
        try {
          const { getMockClientesLocal, setMockClientesLocal } = await import('../../../infrastructure/api/mock/services/mockClienteService');
          const clients = getMockClientesLocal();
          const nextClients = clients.map(c => 
            c.uid === target.cliente_id 
              ? { ...c, saldoPendienteArs: Math.max(0, Number((c.saldoPendienteArs - target.saldo).toFixed(2))) } 
              : c
          );
          setMockClientesLocal(nextClients);
        } catch {
          // ignore
        }
      }

      mockComprobantes = mockComprobantes.map(c => 
        c.id === id || c.legacy_uid === id 
          ? { ...c, estado: 'ANULADO' as const, saldo: 0 } 
          : c
      );
      return;
    }

    const isUuid = id.includes('-');
    let query = supabaseClient.from('comprobantes').update({
      estado: 'ANULADO',
      saldo: 0,
      updated_at: new Date().toISOString()
    });

    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('legacy_uid', id);
    }

    const { error } = await query;
    if (error) throw error;
  }
};
