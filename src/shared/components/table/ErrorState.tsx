import React from 'react';

export const ErrorState: React.FC<{ message?: string }> = ({ message = 'Ocurrió un error al cargar la tabla.' }) => (
  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
);
