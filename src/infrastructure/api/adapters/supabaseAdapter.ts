import { mockFormulaService } from '../mock/services/mockFormulaService';
import { mockOrdenService } from '../mock/services/mockOrdenService';
import { mockUsuarioService } from '../mock/services/mockUsuarioService';
import { supabaseInsumoService } from '../supabase/services/supabaseInsumoService';
import { supabaseProveedorService } from '../supabase/services/supabaseProveedorService';
import { supabaseSiloService } from '../supabase/services/supabaseSiloService';
import { supabaseStockMPService } from '../supabase/services/supabaseStockMPService';
import type { ApiServices } from '../types';

export const supabaseAdapter: ApiServices = {
  // Sprint 1: usuarios/formulas/ordenes se mantienen en mock para no romper flujo actual
  usuarios: mockUsuarioService,
  formulas: mockFormulaService,
  ordenes: mockOrdenService,

  proveedores: supabaseProveedorService,
  insumos: supabaseInsumoService,
  stockMP: supabaseStockMPService,
  silos: supabaseSiloService,
};
