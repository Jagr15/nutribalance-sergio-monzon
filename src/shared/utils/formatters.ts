export const formatDateDDMMYYYY = (value: string | Date | null | undefined) => {
  if (!value) return 'Sin fecha';
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

export const parseNumericInput = (value: string) => {
  if (value.trim() === '') return null;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatNumericInput = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '');
