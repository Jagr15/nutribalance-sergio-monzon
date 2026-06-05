import React from 'react';
import { cn } from './utils';

const statusMap: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-700 border-slate-200',
  'en proceso': 'bg-blue-50 text-blue-700 border-blue-200',
  finalizado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  anulado: 'bg-red-50 text-red-700 border-red-200',

  critica: 'bg-red-50 text-red-700 border-red-200',
  alta: 'bg-orange-50 text-orange-700 border-orange-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  baja: 'bg-slate-100 text-slate-700 border-slate-200',
  informativa: 'bg-slate-100 text-slate-700 border-slate-200',

  disponible: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bajo: 'bg-amber-50 text-amber-700 border-amber-200',
  'crítico': 'bg-red-50 text-red-700 border-red-200',
  critico: 'bg-red-50 text-red-700 border-red-200',
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',

  ingreso: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  egreso: 'bg-red-50 text-red-700 border-red-200',
  transferencia: 'bg-blue-50 text-blue-700 border-blue-200',

  activa: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactiva: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const StatusBadge: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  const key = value.trim().toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        statusMap[key] ?? 'bg-slate-100 text-slate-700 border-slate-200',
        className,
      )}
    >
      {value}
    </span>
  );
};
