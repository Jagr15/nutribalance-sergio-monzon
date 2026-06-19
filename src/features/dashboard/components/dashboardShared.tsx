import type { ReactNode } from 'react';

export const KPIBox = ({
  label,
  value,
  trend,
  updatedAt,
  helper,
  tone = 'slate',
}: {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'flat' | 'unknown';
  updatedAt: string;
  helper?: string;
  tone?: 'slate' | 'cyan' | 'emerald' | 'violet' | 'fuchsia' | 'orange' | 'red';
}) => {
  const trendMeta = {
    up: { label: 'Tendencia al alza', className: 'text-emerald-600' },
    down: { label: 'Tendencia a la baja', className: 'text-rose-600' },
    flat: { label: 'Tendencia estable', className: 'text-slate-500' },
    unknown: { label: 'Sin base histórica', className: 'text-slate-400' },
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone === 'cyan' ? 'text-cyan-700' : tone === 'emerald' ? 'text-emerald-700' : tone === 'violet' ? 'text-violet-700' : tone === 'fuchsia' ? 'text-fuchsia-700' : tone === 'orange' ? 'text-orange-600' : tone === 'red' ? 'text-red-600' : 'text-slate-900'}`}>
        {value}
      </p>
      <p className={`mt-2 text-xs font-semibold ${trendMeta[trend].className}`}>{trendMeta[trend].label}</p>
      <p className="mt-1 text-[11px] text-slate-500">Actualizado: {updatedAt}</p>
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
};

export const SectionTitle = ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
  <div className="mb-4 flex items-end justify-between gap-3">
    <div>
      <h2 className="text-2xl font-black text-slate-900 mt-1">{title}</h2>
      <p className="text-sm text-slate-500 mt-2">{description}</p>
    </div>
    {action}
  </div>
);
