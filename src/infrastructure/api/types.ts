import type { Formula } from '../../features/formulas/types';
import type { Cliente, ClienteEstadoCuentaItem, ClientePagoPayload, ClientePagoHistorial } from '../../features/clientes/types/cliente';
import type {
  HistorialCompraMP,
  Insumo,
  StockMateriaPrima,
  StockMateriaPrimaResumen,
  UltimoPrecioPagadoInsumo,
} from '../../features/insumos/types';
import type { OrdenProduccion } from '../../features/ordenes/types';
import type { ActualizarOrdenExpedicionPayload, OrdenExpedicion, RegistrarOrdenExpedicionPayload } from '../../features/ordenes/types';
import type {
  MovimientoStockPT,
  RegistrarSalidaStockPTData,
  StockProductoTerminado,
  StockProductoTerminadoResumen,
} from '../../features/productos/types';
import type {
  ActualizarConfiguracionEmpaquePayload,
  ConfiguracionEmpaque,
  CrearConfiguracionEmpaquePayload,
} from '../../features/productos/types/configuracionEmpaque';
import type {
  MovimientoMPAuditoria,
  TrazabilidadPorOP,
} from '../../features/trazabilidad/types';
import type { Proveedor } from '../../features/proveedores/types';
import type { Silo } from '../../features/silos/types';
import type { Usuario } from '../../features/usuarios/types';
import type { TipoUnidad } from '../../shared/types/global.interface';

export interface UsuariosService {
  getAll: () => Promise<Usuario[]>;
  getById: (uid: string) => Promise<Usuario | undefined>;
  create: (data: Omit<Usuario, 'uid'>) => Promise<Usuario>;
  update: (uid: string, data: Partial<Usuario>) => Promise<Usuario>;
  delete: (uid: string) => Promise<boolean>;
}

export interface ResetSystemResult {
  ok: boolean;
  tablas_limpiadas: string[];
  tablas_totales: number;
}

export interface ClientesService {
  getAll: () => Promise<Cliente[]>;
  getById: (uid: string) => Promise<Cliente | undefined>;
  getEstadoCuentaCliente: (clienteId: string) => Promise<ClienteEstadoCuentaItem[]>;
  create: (data: Omit<Cliente, 'uid' | 'createdAt' | 'updatedAt'>) => Promise<Cliente>;
  update: (uid: string, data: Partial<Omit<Cliente, 'uid'>>) => Promise<Cliente>;
  delete: (uid: string) => Promise<boolean>;
  registrarPago: (payload: ClientePagoPayload) => Promise<void>;
  getPagos: () => Promise<ClientePagoHistorial[]>;
}

export interface ProveedoresService {
  getAll: () => Promise<Proveedor[]>;
  getById: (uid: string) => Promise<Proveedor | undefined>;
  create: (data: Omit<Proveedor, 'uid'>) => Promise<Proveedor>;
  update: (uid: string, data: Partial<Proveedor>) => Promise<Proveedor>;
  delete: (uid: string) => Promise<boolean>;
  toggleActive: (uid: string, activo: boolean) => Promise<Proveedor>;
}

export interface InsumosService {
  getAllInsumos: () => Promise<Insumo[]>;
  createInsumo: (data: Omit<Insumo, 'uid'>) => Promise<Insumo>;
  updateInsumo: (uid: string, data: Partial<Insumo>) => Promise<Insumo>;
  deleteInsumo: (uid: string) => Promise<void>;
  findAllStock: () => Promise<StockMateriaPrima[]>;
  createStock: (data: StockMateriaPrima) => Promise<StockMateriaPrima>;
  updateStock: (uid: string, data: Partial<StockMateriaPrima>) => Promise<StockMateriaPrima>;
  deleteStock: (uid: string) => Promise<void>;
}

export interface FormulasService {
  findAll: () => Promise<Formula[]>;
  getById: (uid: string) => Promise<Formula | undefined>;
  create: (data: Omit<Formula, 'uid' | 'ultima_edicion'>) => Promise<Formula>;
  update: (uid: string, data: Partial<Formula>) => Promise<Formula>;
  delete: (uid: string) => Promise<boolean>;
}

export interface StockMPCreateData {
  id_insumo: string;
  id_proveedor: string;
  lote: string;
  remito_nro: string;
  cantidad: number;
  unidad_entrada: TipoUnidad;
  precio_unitario?: number;
  unidad_precio?: 'KG' | 'TON';
  costo_total?: number;
  costo_unitario?: number;
  id_usuario: string;
  fecha_ingreso: Date;
  ubicacion: string;
}

export interface StockMPService {
  getAllLotes: () => Promise<StockMateriaPrima[]>;
  getResumen: () => Promise<StockMateriaPrimaResumen[]>;
  getHistorialCompras: (params?: { periodo?: 'HOY' | 'SEMANA' | 'MES' | 'TODO'; page?: number; pageSize?: number }) => Promise<{ data: HistorialCompraMP[]; total: number }>;
  getUltimosPrecios: () => Promise<UltimoPrecioPagadoInsumo[]>;
  create: (data: StockMPCreateData) => Promise<StockMateriaPrima>;
  update: (uid: string, data: Partial<StockMateriaPrima>) => Promise<StockMateriaPrima>;
  delete: (uid: string) => Promise<void>;
}

export interface SilosService {
  getAll: () => Promise<Silo[]>;
  getById: (uid: string) => Promise<Silo | undefined>;
  create: (data: Omit<Silo, 'uid'>) => Promise<Silo>;
  update: (uid: string, data: Partial<Silo>) => Promise<Silo>;
  delete: (uid: string) => Promise<boolean>;
  toggleActive: (uid: string, activo: boolean) => Promise<Silo>;
}

export interface OrdenesService {
  getAll: () => Promise<OrdenProduccion[]>;
  create: (data: Omit<OrdenProduccion, 'id'>) => Promise<OrdenProduccion>;
  update: (id: string, data: Partial<OrdenProduccion>) => Promise<OrdenProduccion>;
  delete: (id: string) => Promise<boolean>;
}

export interface OrdenesExpedicionService {
  getAll: () => Promise<OrdenExpedicion[]>;
  create: (data: RegistrarOrdenExpedicionPayload) => Promise<OrdenExpedicion>;
  update: (id: string, data: ActualizarOrdenExpedicionPayload) => Promise<OrdenExpedicion>;
  iniciarPreparacion: (id: string) => Promise<OrdenExpedicion>;
  marcarLista: (id: string, kilosRealesCargados: number) => Promise<OrdenExpedicion>;
  despachar: (id: string) => Promise<OrdenExpedicion>;
  cancelar: (id: string) => Promise<OrdenExpedicion>;
  programarEntrega: (id: string, fechaProgramada: string | null, notaProgramacion?: string | null) => Promise<OrdenExpedicion>;
  delete: (id: string) => Promise<boolean>;
}

export interface StockPTService {
  getAll: () => Promise<StockProductoTerminado[]>;
  getResumen: () => Promise<StockProductoTerminadoResumen[]>;
  getMovimientos: () => Promise<MovimientoStockPT[]>;
  registrarSalida: (data: RegistrarSalidaStockPTData) => Promise<StockProductoTerminado>;
}

export interface ConfiguracionEmpaquesService {
  getAll: () => Promise<ConfiguracionEmpaque[]>;
  listByProducto: (productoId: string) => Promise<ConfiguracionEmpaque[]>;
  create: (data: CrearConfiguracionEmpaquePayload) => Promise<ConfiguracionEmpaque>;
  update: (id: string, data: ActualizarConfiguracionEmpaquePayload) => Promise<ConfiguracionEmpaque>;
  toggleActive: (id: string, activo: boolean) => Promise<ConfiguracionEmpaque>;
}

export interface TrazabilidadService {
  getMovimientosMPAuditoria: () => Promise<MovimientoMPAuditoria[]>;
  getTrazabilidadPorOP: () => Promise<TrazabilidadPorOP[]>;
}

export interface ApiServices {
  usuarios: UsuariosService;
  systemAdmin: {
    resetTotalSoloUsuarios: () => Promise<ResetSystemResult>;
  };
  clientes: ClientesService;
  proveedores: ProveedoresService;
  insumos: InsumosService;
  formulas: FormulasService;
  stockMP: StockMPService;
  stockPT: StockPTService;
  configuracionEmpaques: ConfiguracionEmpaquesService;
  empaquesProducto: ConfiguracionEmpaquesService;
  trazabilidad: TrazabilidadService;
  silos: SilosService;
  ordenes: OrdenesService;
  ordenesExpedicion: OrdenesExpedicionService;
}
