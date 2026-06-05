import React from 'react';
import type{ Insumo } from '../types/insumo';

interface Props {
  insumos: Insumo[];
}

const InsumoStats: React.FC<Props> = ({ insumos }) => {
  const totalSKUs = insumos.length;
  const categoriasActivas = new Set(insumos.map((item) => item.categoria).filter(Boolean));
  const totalCategorias = categoriasActivas.size;
  const categoriasLabel = totalCategorias > 0 ? Array.from(categoriasActivas).join(', ') : 'Sin categorías';

  return (
   
<section className="grid grid-cols-1 md:grid-cols-3 gap-6">
  
  {/* Card 1: Muestras Monitoreadas */}
  <div className="bg-white border border-slate-200 rounded-2xl p-6 transition-all hover:border-blue-500/30">
    <div className="flex justify-between items-start mb-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Insumos Activos</p>
      <span className="text-green-400 text-xs font-bold">+12%</span>
    </div>
    <h3 className="text-3xl font-bold text-slate-900">{totalSKUs}</h3>
    <p className="text-gray-500 text-[11px] mt-2">Registros disponibles en catálogo</p>
  </div>

  {/* Card 2: Categorías */}
  <div className="bg-white border border-slate-200 rounded-2xl p-6 transition-all hover:border-orange-500/30">
    <div className="flex justify-between items-start mb-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Categorías Activas</p>
      <span className="text-orange-500 text-[10px] font-bold px-2 py-0.5 bg-orange-500/10 rounded-full">CAT</span>
    </div>
    <h3 className="text-3xl font-bold text-slate-900">{totalCategorias}</h3>
    <p className="text-gray-500 text-[11px] mt-2">Clasificaciones registradas</p>
  </div>

  {/* Card 3: Unidades */}
  <div className="bg-white border border-slate-200 rounded-2xl p-6 transition-all hover:border-cyan-500/30">
    <div className="flex justify-between items-start mb-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Unidades Configuradas</p>
      <p className="text-gray-500 text-[10px] font-bold">UNIDAD</p>
    </div>
    <h3 className="text-3xl font-bold text-slate-900">{new Set(insumos.map((item) => item.unidad_medida).filter(Boolean)).size}</h3>
    <p className="text-gray-500 text-[11px] mt-2 text-ellipsis overflow-hidden whitespace-nowrap">
      {categoriasLabel}
    </p>
  </div>

</section>
  );
};

export default InsumoStats;
