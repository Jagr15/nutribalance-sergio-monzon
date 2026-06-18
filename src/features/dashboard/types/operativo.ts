import type { StockMateriaPrimaResumen } from '../../insumos/types';
import type { StockProductoTerminadoResumen } from '../../productos/types';
import type {
  DashboardPTEntregaCliente,
  DashboardPTParticipacionProducto,
  DashboardPTSalidaProducto,
} from '../utils/productoTerminadoInsights';
import type {
  DashboardExpedicionCliente,
  DashboardExpedicionProducto,
  DashboardExpedicionResumen,
} from '../utils/ordenesExpedicionInsights';

export interface DashboardOperativoKPIs {
  stock_total_mp: number;
  stock_comprometido_mp: number;
  stock_disponible_mp: number;
  stock_critico: number;
  ordenes_pendientes: number;
  ordenes_en_proceso: number;
  ordenes_finalizadas: number;
  produccion_total: number;
  costo_promedio_produccion: number;
  merma_total: number;
  valor_inventario_mp: number;
  stock_total_pt: number;
  valor_inventario_pt: number;
  proteina_promedio_formula: number;
}

export interface DashboardStockResumenes {
  stockMateriaPrima: StockMateriaPrimaResumen[];
  stockProductoTerminado: StockProductoTerminadoResumen[];
}

export interface DashboardProductoTerminadoInsights {
  salidasPorProducto: DashboardPTSalidaProducto[];
  participacionStock: DashboardPTParticipacionProducto[];
  entregasPorCliente: DashboardPTEntregaCliente[];
}

export interface DashboardExpedicionInsights {
  resumen: DashboardExpedicionResumen;
  porProducto: DashboardExpedicionProducto[];
  porCliente: DashboardExpedicionCliente[];
}

export interface FormulaComposicion {
  id_formula: string;
  nombre_producto: string;
  total_pct: number;
  proteina_pct: number;
}

export interface ConsumoMensualInsumo {
  mes: string;
  insumo: string;
  consumo_kg: number;
}

export interface AlertaOperativaRaw {
  alerta_id: string;
  tipo: string;
  prioridad: 'critica' | 'media' | 'informativa';
  area: 'stock' | 'produccion' | 'clientes' | 'costos' | 'productos';
  titulo: string;
  dato_asociado: Record<string, unknown>;
  fecha_evento: string;
}

export interface TrazabilidadVisualRow {
  id: string;
  fecha_evento: string;
  tipo: string;
  referencia: string | null;
  payload: Record<string, unknown>;
  orden_legacy_uid: string | null;
  orden_lote: string | null;
  nombre_producto: string | null;
  lote_mp_legacy_uid: string | null;
  lote_mp: string | null;
  stock_pt_legacy_uid: string | null;
  lote_pt: string | null;
  silo_destino: string | null;
}
