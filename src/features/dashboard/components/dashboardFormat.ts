export const fmtARS = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);

export const fmtDateTime = (value: Date | string | null | undefined) => {
  if (!value) return 'Sin actualización';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin actualización';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

export const fmtRelativeMinutes = (value: Date | null) => {
  if (!value) return 'Sin actualización';
  const diffMs = Date.now() - value.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `Actualizado hace ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Actualizado hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  return `Actualizado hace ${days} días`;
};

export type TrendTone = 'up' | 'down' | 'flat' | 'unknown';

export const getTrendTone = (current: number, previous: number | null | undefined, higherIsBetter = true): TrendTone => {
  if (previous === null || previous === undefined) return 'unknown';
  if (Math.abs(current - previous) < 0.0001) return 'flat';
  const improved = higherIsBetter ? current > previous : current < previous;
  return improved ? 'up' : 'down';
};
