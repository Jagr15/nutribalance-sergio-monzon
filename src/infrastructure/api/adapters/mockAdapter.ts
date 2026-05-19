import { mockFormulaService } from '../mock/services/mockFormulaService';
import { mockInsumoService } from '../mock/services/mockInsumoService';
import { mockOrdenService } from '../mock/services/mockOrdenService';
import { mockProveedorService } from '../mock/services/mockProveedorService';
import { mockSiloService } from '../mock/services/mockSiloService';
import { mockUsuarioService } from '../mock/services/mockUsuarioService';
import { mockMateriaPrimaService } from '../mock/services/mockMateriaPrimaService';
import type { ApiServices } from '../types';

export const mockAdapter: ApiServices = {
  usuarios: mockUsuarioService,
  proveedores: mockProveedorService,
  insumos: mockInsumoService,
  formulas: mockFormulaService,
  stockMP: mockMateriaPrimaService,
  silos: mockSiloService,
  ordenes: mockOrdenService,
};
