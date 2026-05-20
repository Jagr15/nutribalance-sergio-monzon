import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom"; // Importación clave
import { ROUTES } from "../../../../app/config/routes"; // Tus constantes de rutas
import {
  FiGrid, FiUsers, FiPackage, FiTruck, FiBarChart2,
   FiLogOut,FiInbox,FiDatabase,
  FiLayers, FiArchive, FiChevronDown, FiChevronRight, FiGitMerge,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { clearSession, getSessionUser } from "../../../../features/auth/session";

interface SidebarItem {
  name: string;
  icon: IconType;
  path: string;
}

interface SidebarGroup {
  section: string;
  collapsible: boolean;
  items: SidebarItem[];
}

// Agregamos el campo 'path' al objeto para vincularlo con el Router
const menuItems: SidebarGroup[] = [
  {
    section: "GENERAL",
    collapsible: false,
    items: [
      { name: "Dashboard", icon: FiGrid, path: ROUTES.DASHBOARD },
      { name: "Clientes", icon: FiUsers, path: ROUTES.CLIENTES },
      { name: "Stock General", icon: FiPackage, path: ROUTES.STOCK },
      { name: "Proveedores", icon: FiTruck, path: ROUTES.PROVEEDORES },
    ],
  },
  {
    section: "PRODUCCIÓN",
    collapsible: true,
    items: [
      { name: "Silos", icon: FiDatabase, path: ROUTES.SILOS },
      { name: "Insumos", icon: FiArchive, path: ROUTES.INSUMOS },
      { name: "Fórmulas", icon: FiLayers, path: ROUTES.FORMULAS },
      { name: "Órdenes", icon: FiLayers, path: ROUTES.ORDENES},
      { name: "Costos", icon: FiBarChart2, path: ROUTES.COSTOS },
      { name: "Trazabilidad", icon: FiGitMerge, path: ROUTES.TRAZABILIDAD },
    ],
  },
  {
    section: "INVENTARIO",
    collapsible: true,
    items: [
      { name: "Stock Materia Prima", icon: FiInbox, path: ROUTES.STOCKMATERIAPRIMA },
      { name: "Stock de Productos Terminados", icon: FiPackage, path: ROUTES.PRODUCTOS },
    ],
  },
  // ... resto de secciones (puedes añadir los paths que necesites)
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getSessionUser();
  const [openSections, setOpenSections] = useState<string[]>(["PRODUCCIÓN", "INVENTARIO"]);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handleLogout = () => {
    clearSession();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    // CAMBIO 1: h-screen y overflow-hidden para fijar el alto total
    <aside className="w-[230px] h-screen bg-[#0d131d] border-r border-white/5 flex flex-col overflow-hidden sticky top-0">
      
      {/* LOGO: Se mantiene fijo arriba */}
      <div className="px-5 py-5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-lg font-bold">
            N
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white">Nutribalance</h1>
            <p className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Producción e Inventario</p>
          </div>
        </div>
      </div>

      {/* CAMBIO 2: Este contenedor ahora es el que scrollea independientemente */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-5">
        {menuItems.map((group) => {
          const isOpen = openSections.includes(group.section);
          return (
            <div key={group.section}>
              <button
                onClick={() => group.collapsible && toggleSection(group.section)}
                aria-label={`Alternar sección ${group.section}`}
                className="w-full flex items-center justify-between px-3 mb-2"
              >
                <p className="text-[10px] tracking-[0.25em] uppercase text-gray-600 font-semibold text-left">
                  {group.section}
                </p>
                {group.collapsible && (
                  <div className="text-gray-500">
                    {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  </div>
                )}
              </button>

              {(!group.collapsible || isOpen) && (
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                      <NavLink
                        key={item.name}
                        to={item.path || "#"}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                          ${isActive 
                              ? "bg-blue-500/10 text-white" 
                              : "text-gray-400 hover:bg-white/5 hover:text-white"}
                        `}
                      >
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center
                          ${isActive ? "bg-blue-500 text-white" : "bg-white/5"}
                        `}>
                          <Icon size={15} />
                        </div>
                        <span className="text-[13px] font-medium">{item.name}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* USER PROFILE: Se mantiene fijo abajo */}
      <div className="p-3 border-t border-white/5 flex-shrink-0">
        <div className="bg-white/[0.03] rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
            <div className="flex-1">
              <h4 className="font-medium text-[13px]">{currentUser.name}</h4>
              <p className="text-[11px] text-gray-500">{currentUser.role}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar sesión"
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 transition"
            >
              <FiLogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
