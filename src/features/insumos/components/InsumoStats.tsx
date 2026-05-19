import React from 'react';
import type{ Insumo } from '../types/insumo';

interface Props {
  insumos: Insumo[];
}

const InsumoStats: React.FC<Props> = ({ insumos }) => {
  // Lógica para detectar stock crítico (simulada o basada en umbral)
  const totalSKUs = insumos.length;
  const alertasActivas = insumos.filter(i => i.umbral_alerta > 100).length; // Ejemplo de lógica

  return (
   
<section className="grid grid-cols-1 md:grid-cols-3 gap-6">
  
  {/* Card 1: Muestras Monitoreadas */}
  <div className="bg-[#0f1722] border border-white/5 rounded-2xl p-6 transition-all hover:border-blue-500/30">
    <div className="flex justify-between items-start mb-4">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Muestras Monitoreadas</p>
      <span className="text-green-400 text-xs font-bold">+12%</span>
    </div>
    <h3 className="text-3xl font-bold text-white">{totalSKUs}</h3>
    <p className="text-gray-500 text-[11px] mt-2">Insumos activos en catálogo</p>
  </div>

  {/* Card 2: Alertas */}
  <div className="bg-[#0f1722] border border-white/5 rounded-2xl p-6 transition-all hover:border-orange-500/30">
    <div className="flex justify-between items-start mb-4">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Alertas de Reabastecimiento</p>
      <span className="text-orange-500 text-[10px] font-bold px-2 py-0.5 bg-orange-500/10 rounded-full">CRÍTICO</span>
    </div>
    <h3 className="text-3xl font-bold text-white">{alertasActivas}</h3>
    <p className="text-gray-500 text-[11px] mt-2">Insumos por debajo del umbral</p>
  </div>

  {/* Card 3: Distribución */}
  <div className="bg-[#0f1722] border border-white/5 rounded-2xl p-6 transition-all hover:border-cyan-500/30">
    <div className="flex justify-between items-start mb-4">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Distribución</p>
      <p className="text-gray-500 text-[10px] font-bold">CATEGORÍAS</p>
    </div>
    <h3 className="text-3xl font-bold text-white">3</h3>
    <p className="text-gray-500 text-[11px] mt-2 text-ellipsis overflow-hidden whitespace-nowrap">
      Granos, Suplementos, Aditivos
    </p>
  </div>

</section>
  );
};

export default InsumoStats;
