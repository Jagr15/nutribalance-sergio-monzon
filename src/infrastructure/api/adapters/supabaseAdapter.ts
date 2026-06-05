import { mockUsuarioService } from '../mock/services/mockUsuarioService';
import { supabaseFormulaService } from '../supabase/services/supabaseFormulaService';
import { supabaseInsumoService } from '../supabase/services/supabaseInsumoService';
import { supabaseOrdenService } from '../supabase/services/supabaseOrdenService';
import { supabaseProveedorService } from '../supabase/services/supabaseProveedorService';
import { supabaseSiloService } from '../supabase/services/supabaseSiloService';
import { supabaseStockMPService } from '../supabase/services/supabaseStockMPService';
import { supabaseStockPTService } from '../supabase/services/supabaseStockPTService';
import type { ApiServices } from '../types';

export const supabaseAdapter: ApiServices = {
  // Sprint 1 Fase 1: usuarios se mantienen en mock; formulas/ordenes ya operan en Supabase.
  usuarios: mockUsuarioService,
  formulas: supabaseFormulaService,
  ordenes: supabaseOrdenService,

  proveedores: supabaseProveedorService,
  insumos: supabaseInsumoService,
  stockMP: supabaseStockMPService,
  stockPT: supabaseStockPTService,
  silos: supabaseSiloService,
};
