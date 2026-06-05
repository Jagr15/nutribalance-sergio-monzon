import React from 'react';
import { cn } from './utils';

export const TableHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <thead className={cn('bg-slate-50 text-slate-600', className)}>{children}</thead>
);
