import React from 'react';

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Cargando datos...' }) => (
  <div className="py-12 text-center">
    <div className="mx-auto h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
    <p className="text-sm text-slate-500 mt-3">{label}</p>
  </div>
);
