import React from 'react';
import { cn } from './utils';

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
  minWidthClassName?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ children, className, minWidthClassName }) => (
  <div className={cn('bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden', className)}>
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left border-collapse', minWidthClassName)}>{children}</table>
    </div>
  </div>
);
