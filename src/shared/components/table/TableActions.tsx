import React from 'react';
import { cn } from './utils';

export type ActionTone = 'primary' | 'success' | 'secondary' | 'danger';

const toneClass: Record<ActionTone, string> = {
  primary: 'border-blue-200 text-blue-700 hover:bg-blue-50',
  success: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  secondary: 'border-slate-200 text-slate-700 hover:bg-slate-100',
  danger: 'border-red-200 text-red-700 hover:bg-red-50',
};

export const TableActionButton: React.FC<{
  label: string;
  onClick: () => void;
  tone?: ActionTone;
  disabled?: boolean;
}> = ({ label, onClick, tone = 'secondary', disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'h-8 px-3 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50',
      toneClass[tone],
    )}
  >
    {label}
  </button>
);

export const TableActions: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('flex items-center justify-end gap-2', className)}>{children}</div>
);
