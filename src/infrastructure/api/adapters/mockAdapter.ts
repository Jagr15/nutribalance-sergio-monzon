import { mockFormulaService } from '../mock/services/mockFormulaService';
import { mockInsumoService } from '../mock/services/mockInsumoService';
import { mockOrdenService } from '../mock/services/mockOrdenService';
import { mockProveedorService } from '../mock/services/mockProveedorService';
import { mockSiloService } from '../mock/services/mockSiloService';
import { mockStockPTService } from '../mock/services/mockStockPTService';
import { mockUsuarioService } from '../mock/services/mockUsuarioService';
import { mockMateriaPrimaService } from '../mock/services/mockMateriaPrimaService';
import type { ApiServices } from '../types';

export const mockAdapter: ApiServices = {
  usuarios: mockUsuarioService,
  proveedores: mockProveedorService,
  insumos: mockInsumoService,
  formulas: mockFormulaService,
  stockMP: mockMateriaPrimaService,
  stockPT: mockStockPTService,
  silos: mockSiloService,
  ordenes: mockOrdenService,
};
