import React from 'react';
import { cn } from './utils';

export const TableRow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <tr className={cn('hover:bg-slate-50 transition-colors', className)}>{children}</tr>
);
