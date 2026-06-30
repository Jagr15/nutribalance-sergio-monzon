import { supabaseClienteService } from '../supabase/services/supabaseClienteService';
import { mockUsuarioService } from '../mock/services/mockUsuarioService';
import { supabaseFormulaService } from '../supabase/services/supabaseFormulaService';
import { supabaseInsumoService } from '../supabase/services/supabaseInsumoService';
import { supabaseOrdenService } from '../supabase/services/supabaseOrdenService';
import { supabaseOrdenesExpedicionService } from '../supabase/services/supabaseOrdenesExpedicionService';
import { supabaseProveedorService } from '../supabase/services/supabaseProveedorService';
import { supabaseSiloService } from '../supabase/services/supabaseSiloService';
import { supabaseStockMPService } from '../supabase/services/supabaseStockMPService';
import { supabaseStockPTService } from '../supabase/services/supabaseStockPTService';
import { supabaseConfiguracionEmpaqueService } from '../supabase/services/supabaseConfiguracionEmpaqueService';
import { supabaseTrazabilidadService } from '../supabase/services/supabaseTrazabilidadService';
import type { ApiServices } from '../types';

export const supabaseAdapter: ApiServices = {
  // Sprint 1 Fase 1: usuarios se mantienen en mock; formulas/ordenes ya operan en Supabase.
  usuarios: mockUsuarioService,
  clientes: supabaseClienteService,
  formulas: supabaseFormulaService,
  ordenes: supabaseOrdenService,
  ordenesExpedicion: supabaseOrdenesExpedicionService,

  proveedores: supabaseProveedorService,
  insumos: supabaseInsumoService,
  stockMP: supabaseStockMPService,
  stockPT: supabaseStockPTService,
  configuracionEmpaques: supabaseConfiguracionEmpaqueService,
  empaquesProducto: supabaseConfiguracionEmpaqueService,
  trazabilidad: supabaseTrazabilidadService,
  silos: supabaseSiloService,
};
