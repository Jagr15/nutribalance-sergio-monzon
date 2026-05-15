// src/shared/layouts/MainLayout.tsx
import { Sidebar } from '../../layouts/admin/components/Sidebar';
import { Header } from '../../layouts/admin/components/Header';
import { Outlet } from "react-router-dom";

export const MainLayout = () => {
  return (
    <div className="flex min-h-screen bg-[#0a0e14] text-white">
      {/* Sidebar Fijo */}
      <Sidebar />
      
      {/* Contenedor derecho: mide el alto de pantalla y no deja que el scroll afecte a todo el dashboard */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Header se queda arriba */}
        <Header />
        
        {/* CAMBIO AQUÍ: 
          1. flex-1 para que ocupe todo el espacio sobrante.
          2. overflow-y-auto para permitir el scroll solo en esta zona.
          3. custom-scrollbar (opcional) para que se vea profesional como en IAWAREPERU.
        */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};