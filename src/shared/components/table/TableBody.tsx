import React from 'react';
import { cn } from './utils';

export const TableBody: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <tbody className={cn('divide-y divide-slate-100', className)}>{children}</tbody>
);
