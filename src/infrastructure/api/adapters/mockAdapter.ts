import { mockClienteService } from '../mock/services/mockClienteService';
import { mockFormulaService } from '../mock/services/mockFormulaService';
import { mockInsumoService } from '../mock/services/mockInsumoService';
import { mockOrdenService } from '../mock/services/mockOrdenService';
import { mockOrdenesExpedicionService } from '../mock/services/mockOrdenesExpedicionService';
import { mockProveedorService } from '../mock/services/mockProveedorService';
import { mockSiloService } from '../mock/services/mockSiloService';
import { mockStockPTService } from '../mock/services/mockStockPTService';
import { mockEmpaquesProductoService } from '../mock/services/mockEmpaquesProductoService';
import { mockConfiguracionEmpaquesService } from '../mock/services/mockConfiguracionEmpaquesService';
import { mockUsuarioService } from '../mock/services/mockUsuarioService';
import { mockMateriaPrimaService } from '../mock/services/mockMateriaPrimaService';
import { mockTrazabilidadService } from '../mock/services/mockTrazabilidadService';
import { mockSystemAdminService } from '../mock/services/mockSystemAdminService';
import type { ApiServices } from '../types';

export const mockAdapter: ApiServices = {
  usuarios: mockUsuarioService,
  systemAdmin: mockSystemAdminService,
  clientes: mockClienteService,
  proveedores: mockProveedorService,
  insumos: mockInsumoService,
  formulas: mockFormulaService,
  stockMP: {
    ...mockMateriaPrimaService,
    getHistorialCompras: async (params) => {
      const historial = await mockMateriaPrimaService.getHistorialCompras();
      const page = Math.max(1, Number(params?.page ?? 1));
      const pageSize = Math.max(1, Number(params?.pageSize ?? 10));
      const periodo = params?.periodo ?? 'HOY';
      const end = new Date();
      const start = new Date(end);
      if (periodo === 'HOY') {
        start.setHours(0, 0, 0, 0);
      } else if (periodo === 'SEMANA') {
        const day = start.getDay() || 7;
        start.setDate(start.getDate() - (day - 1));
        start.setHours(0, 0, 0, 0);
      } else if (periodo === 'MES') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      } else {
        start.setTime(0);
      }
      const filtered = periodo === 'TODO' ? historial : historial.filter((row) => {
        const fecha = new Date(row.fecha_compra);
        return fecha >= start && fecha <= end;
      });
      const from = (page - 1) * pageSize;
      return {
        data: filtered.slice(from, from + pageSize),
        total: filtered.length,
      };
    },
  },
  stockPT: mockStockPTService,
  configuracionEmpaques: mockConfiguracionEmpaquesService,
  empaquesProducto: mockEmpaquesProductoService as never,
  trazabilidad: mockTrazabilidadService,
  silos: mockSiloService,
  ordenes: mockOrdenService,
  ordenesExpedicion: {
    ...mockOrdenesExpedicionService,
    iniciarPreparacion: mockOrdenesExpedicionService.iniciarPreparacion,
    marcarLista: mockOrdenesExpedicionService.marcarLista,
    programarEntrega: mockOrdenesExpedicionService.programarEntrega,
  },
};
