export type PrioridadAlerta = "critica" | "media" | "informativa";
export type AreaAlerta = "stock" | "produccion" | "clientes" | "costos" | "productos" | "tesoreria";
export type EstadoAlerta = "pendiente" | "en seguimiento" | "atendida" | "descartada";

export interface DatoAsociadoAlerta {
  lote?: string;
  orden?: string;
  cliente?: string;
  producto?: string;
  cheque?: string;
  insumo?: string;
  disponible_kg?: number;
  umbral_kg?: number;
  estado?: string;
  cantidad_objetivo?: number;
}

export interface AlertaOperativa {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadAlerta;
  area: AreaAlerta;
  estado: EstadoAlerta;
  fechaEvento: string;
  fechaRelativa: string;
  datoAsociado: DatoAsociadoAlerta;
  accionRecomendada: string;
  impactoOperativo: string;
}

export type AlertaModulo = 'stock' | 'produccion' | 'tesoreria' | 'clientes' | 'costos';
export type AlertaEntidadTipo = 'insumo' | 'producto_terminado' | 'silo' | 'cheque_emitido' | 'cheque_recibido' | 'orden' | 'cliente';
export type AlertaSeveridad = 'verde' | 'amarillo' | 'rojo';

export interface AlertaConfiguracion {
  id: string;
  modulo: AlertaModulo;
  entidad_tipo: AlertaEntidadTipo;
  entidad_id: string | null;
  nombre: string;
  umbral_minimo: number | null;
  umbral_critico: number | null;
  unidad: string | null;
  dias_anticipacion: number | null;
  severidad: AlertaSeveridad;
  esta_activa: boolean;
  created_at: string;
  updated_at: string;
}
