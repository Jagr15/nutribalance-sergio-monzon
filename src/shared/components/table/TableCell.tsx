import React from 'react';
import { cn } from './utils';

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  header?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({ children, className, header }) => {
  const Comp = header ? 'th' : 'td';
  return <Comp className={cn('px-4 py-3 text-sm', header ? 'font-semibold uppercase tracking-wide text-xs' : 'text-slate-900', className)}>{children}</Comp>;
};
