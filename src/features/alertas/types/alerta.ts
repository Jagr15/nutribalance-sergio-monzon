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
