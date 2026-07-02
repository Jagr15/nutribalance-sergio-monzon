import type { OrdenExpedicion } from '../types';

export type PresentacionExpedicionKey =
  | 'GRANEL_KG'
  | 'TONELADA'
  | 'BOLSA_15'
  | 'BOLSA_20'
  | 'BOLSA_25'
  | 'BOLSA_40'
  | 'BIG_BAG_500'
  | 'BIG_BAG_1000';

export type PresentacionExpedicionTipo = 'GRANEL' | 'BOLSA' | 'BIG_BAG';

export interface PresentacionExpedicionOption {
  key: PresentacionExpedicionKey;
  label: string;
  tipo: PresentacionExpedicionTipo | 'TONELADA';
  capacidadKg: number | null;
}

export interface PresentacionExpedicionPersistencia {
  presentacion: PresentacionExpedicionTipo;
  modo_calculo: 'kg_requeridos' | 'empaques';
  tipo_empaque: 'BOLSA' | 'BIG_BAG' | null;
  capacidad_empaque_kg: number | null;
  cantidad_empaques: number | null;
}

export const PRESENTACION_EXPEDICION_OPTIONS: PresentacionExpedicionOption[] = [
  { key: 'GRANEL_KG', label: 'A granel / kilos', tipo: 'GRANEL', capacidadKg: null },
  { key: 'TONELADA', label: 'Toneladas', tipo: 'TONELADA', capacidadKg: 1000 },
  { key: 'BOLSA_15', label: 'Bolsa 15 kg', tipo: 'BOLSA', capacidadKg: 15 },
  { key: 'BOLSA_20', label: 'Bolsa 20 kg', tipo: 'BOLSA', capacidadKg: 20 },
  { key: 'BOLSA_25', label: 'Bolsa 25 kg', tipo: 'BOLSA', capacidadKg: 25 },
  { key: 'BOLSA_40', label: 'Bolsa 40 kg', tipo: 'BOLSA', capacidadKg: 40 },
  { key: 'BIG_BAG_500', label: 'Big Bag 500 kg', tipo: 'BIG_BAG', capacidadKg: 500 },
  { key: 'BIG_BAG_1000', label: 'Big Bag 1000 kg', tipo: 'BIG_BAG', capacidadKg: 1000 },
];

const EXACT_KEYS = new Set<PresentacionExpedicionKey>(PRESENTACION_EXPEDICION_OPTIONS.map((option) => option.key));

const BAG_CAPACITIES = [15, 20, 25, 40] as const;
const BIG_BAG_CAPACITIES = [500, 1000] as const;

export const isPresentacionExpedicionKey = (value: unknown): value is PresentacionExpedicionKey =>
  typeof value === 'string' && EXACT_KEYS.has(value as PresentacionExpedicionKey);

export const getPresentacionExpedicionOption = (key: string | null | undefined): PresentacionExpedicionOption =>
  PRESENTACION_EXPEDICION_OPTIONS.find((item) => item.key === key) ?? PRESENTACION_EXPEDICION_OPTIONS[0];

export const getPresentacionExpedicionKeyFromOrder = (orden: Pick<OrdenExpedicion, 'presentacion_key' | 'presentacion' | 'unidad_cantidad' | 'unidad_original' | 'capacidad_empaque_kg' | 'cantidad_empaques' | 'cantidad_kg'> | null | undefined): PresentacionExpedicionKey => {
  if (!orden) return 'GRANEL_KG';
  if (isPresentacionExpedicionKey(orden.presentacion_key)) return orden.presentacion_key;

  if (orden.presentacion === 'GRANEL') {
    const unidad = String(orden.unidad_cantidad ?? orden.unidad_original ?? '').trim().toLowerCase();
    if (unidad === 'tonelada') {
      return 'TONELADA';
    }
    return 'GRANEL_KG';
  }

  if (orden.presentacion === 'BOLSA') {
    const stored = Number(orden.capacidad_empaque_kg ?? 0);
    if (BAG_CAPACITIES.some((capacidad) => capacidad === stored)) return `BOLSA_${stored}` as PresentacionExpedicionKey;
    const cantidadKg = Number(orden.cantidad_kg ?? 0);
    const cantidadEmpaques = Number(orden.cantidad_empaques ?? 0);
    if (cantidadKg > 0 && cantidadEmpaques > 0) {
      const inferred = Math.round(cantidadKg / cantidadEmpaques);
      if (BAG_CAPACITIES.some((capacidad) => capacidad === inferred)) return `BOLSA_${inferred}` as PresentacionExpedicionKey;
    }
    return 'BOLSA_20';
  }

  if (orden.presentacion === 'BIG_BAG') {
    const stored = Number(orden.capacidad_empaque_kg ?? 0);
    if (BIG_BAG_CAPACITIES.some((capacidad) => capacidad === stored)) return `BIG_BAG_${stored}` as PresentacionExpedicionKey;
    const cantidadKg = Number(orden.cantidad_kg ?? 0);
    const cantidadEmpaques = Number(orden.cantidad_empaques ?? 0);
    if (cantidadKg > 0 && cantidadEmpaques > 0) {
      const inferred = Math.round(cantidadKg / cantidadEmpaques);
      if (BIG_BAG_CAPACITIES.some((capacidad) => capacidad === inferred)) return `BIG_BAG_${inferred}` as PresentacionExpedicionKey;
    }
    return 'BIG_BAG_1000';
  }

  return 'GRANEL_KG';
};

export const getCantidadEntradaInicialFromOrder = (
  orden: Pick<OrdenExpedicion, 'cantidad_kg' | 'cantidad_original' | 'cantidad_empaques'> | null | undefined,
  presentacionKey: PresentacionExpedicionKey
) => {
  if (!orden) return '';
  const option = getPresentacionExpedicionOption(presentacionKey);

  if (option.key === 'GRANEL_KG') {
    const cantidadKg = Number(orden.cantidad_kg ?? orden.cantidad_original ?? 0);
    return cantidadKg > 0 ? String(cantidadKg) : '';
  }

  if (option.key === 'TONELADA') {
    const cantidadKg = Number(orden.cantidad_kg ?? 0);
    return cantidadKg > 0 ? String(Number((cantidadKg / 1000).toFixed(3))) : '';
  }

  const cantidadKg = Number(orden.cantidad_kg ?? 0);
  if (option.capacidadKg && cantidadKg > 0) {
    return String(Number((cantidadKg / option.capacidadKg).toFixed(3)));
  }

  const cantidadEmpaques = Number(orden.cantidad_empaques ?? 0);
  if (cantidadEmpaques > 0) {
    return String(cantidadEmpaques);
  }

  return '1';
};

export const getKgRealesFromPresentation = (presentacionKey: PresentacionExpedicionKey, cantidad: number) => {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 0;
  const option = getPresentacionExpedicionOption(presentacionKey);
  if (option.key === 'GRANEL_KG') return cantidad;
  if (option.key === 'TONELADA') return Number((cantidad * 1000).toFixed(3));
  return Number((cantidad * Number(option.capacidadKg ?? 0)).toFixed(3));
};

export const getCantidadLabelFromPresentation = (presentacionKey: PresentacionExpedicionKey) => {
  const option = getPresentacionExpedicionOption(presentacionKey);
  if (option.key === 'GRANEL_KG') return 'Cantidad de kilos';
  if (option.key === 'TONELADA') return 'Cantidad de toneladas';
  if (option.tipo === 'BOLSA') return 'Cantidad de bolsas';
  return 'Cantidad de big bags';
};

export const buildPresentacionPersistencia = (
  presentacionKey: PresentacionExpedicionKey,
  cantidadUnidades: number
): PresentacionExpedicionPersistencia => {
  const option = getPresentacionExpedicionOption(presentacionKey);
  if (option.key === 'GRANEL_KG' || option.key === 'TONELADA') {
    return {
      presentacion: 'GRANEL',
      modo_calculo: 'kg_requeridos',
      tipo_empaque: null,
      capacidad_empaque_kg: null,
      cantidad_empaques: null,
    };
  }

  return {
    presentacion: option.tipo === 'BIG_BAG' ? 'BIG_BAG' : 'BOLSA',
    modo_calculo: 'empaques',
    tipo_empaque: option.tipo === 'BIG_BAG' ? 'BIG_BAG' : 'BOLSA',
    capacidad_empaque_kg: option.capacidadKg,
    cantidad_empaques: cantidadUnidades > 0 ? cantidadUnidades : null,
  };
};

export const formatPresentacionResumen = (
  presentacionKey: PresentacionExpedicionKey,
  cantidadUnidades: number,
  kgReales: number
) => {
  const option = getPresentacionExpedicionOption(presentacionKey);
  if (option.key === 'GRANEL_KG') {
    return [
      { label: 'Tipo', value: 'A granel' },
      { label: 'Cantidad de kilos', value: String(cantidadUnidades) },
      { label: 'Total kg', value: `${kgReales} kg` },
    ];
  }
  if (option.key === 'TONELADA') {
    return [
      { label: 'Tipo', value: 'Toneladas' },
      { label: 'Cantidad de toneladas', value: String(cantidadUnidades) },
      { label: 'Total kg', value: `${kgReales} kg` },
    ];
  }
  return [
    { label: 'Tipo', value: option.tipo === 'BOLSA' ? 'Bolsa' : 'Big Bag' },
    { label: `Capacidad por ${option.tipo === 'BOLSA' ? 'bolsa' : 'big bag'}`, value: `${option.capacidadKg} kg` },
    { label: option.tipo === 'BOLSA' ? 'Cantidad de bolsas' : 'Cantidad de big bags', value: String(cantidadUnidades) },
    { label: 'Total kg', value: `${kgReales} kg` },
  ];
};

export const formatCantidadVisualOrden = (orden: Pick<OrdenExpedicion, 'presentacion_key' | 'presentacion' | 'cantidad_kg' | 'cantidad_original' | 'cantidad_empaques' | 'capacidad_empaque_kg' | 'unidad_cantidad' | 'unidad_original'> | null | undefined) => {
  if (!orden) return '';
  const key = getPresentacionExpedicionKeyFromOrder(orden);
  const option = getPresentacionExpedicionOption(key);
  if (option.key === 'GRANEL_KG') return `${Number(orden.cantidad_kg ?? orden.cantidad_original ?? 0).toLocaleString('es-AR')} kg`;
  if (option.key === 'TONELADA') {
    const toneladas = Number(orden.cantidad_kg ?? 0) / 1000;
    return `${Number(toneladas.toFixed(3)).toLocaleString('es-AR')} tn`;
  }
  const amount = option.capacidadKg && Number(orden.cantidad_kg ?? 0) > 0
    ? Number((Number(orden.cantidad_kg ?? 0) / option.capacidadKg).toFixed(3))
    : Number(orden.cantidad_empaques ?? 0);
  return `${Number(amount).toLocaleString('es-AR')} ${option.tipo === 'BOLSA' ? 'bolsas' : 'big bags'}`;
};
