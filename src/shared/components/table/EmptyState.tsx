import React from 'react';

export const EmptyState: React.FC<{ title?: string; message?: string; colSpan?: number }> = ({
  title = 'Sin registros',
  message = 'No hay datos para mostrar en esta tabla.',
  colSpan = 1,
}) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-10 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{message}</p>
    </td>
  </tr>
);
