import { mockUsuarioService } from './mock/services/mockUsuarioService';
import { mockProveedorService } from './mock/services/mockProveedorService';
import { mockInsumoService } from './mock/services/mockInsumoService';
import { mockFormulaService } from './mock/services/mockFormulaService';
import { mockMateriaPrimaService } from './mock/services/mockMateriaPrimaService'; // El que creamos hoy
import {mockSiloService} from './mock/services/mockSiloService';
import { mockOrdenService } from './mock/services/mockOrdenService';

const USE_MOCKS = true;

export const ApiService = {
  usuarios: USE_MOCKS ? mockUsuarioService : ({} as any),
  proveedores: USE_MOCKS ? mockProveedorService : ({} as any),
  insumos: USE_MOCKS ? mockInsumoService : ({} as any),
  formulas: USE_MOCKS ? mockFormulaService : ({} as any),
  // Nuevo: Gestión de Stock y Lotes
  stockMP: USE_MOCKS ? mockMateriaPrimaService : ({} as any),
  silos: USE_MOCKS ? mockSiloService : ({} as any),
  ordenes: USE_MOCKS ? mockOrdenService: ({} as any),
};