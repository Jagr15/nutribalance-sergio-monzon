import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom"; // Importación clave
import { ROUTES } from "../../../../app/config/routes"; // Tus constantes de rutas
import {
  FiGrid, FiUsers, FiPackage, FiTruck, FiBarChart2,
   FiLogOut,FiInbox,FiDatabase,FiDollarSign,
  FiLayers, FiArchive, FiChevronDown, FiChevronRight, FiGitMerge, FiBell,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { clearSession, getSessionUser } from "../../../../features/auth/session";
import { usePermissions } from "../../../../features/auth/usePermissions";
import type { AppModule } from "../../../../features/auth/permissions";
import { BrandLogo } from "../../../../shared/components/BrandLogo";

interface SidebarItem {
  name: string;
  icon: IconType;
  path: string;
  module: AppModule;
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
      { name: "Dashboard", icon: FiGrid, path: ROUTES.DASHBOARD, module: "dashboard" },
      { name: "Clientes", icon: FiUsers, path: ROUTES.CLIENTES, module: "clientes" },
      { name: "Stock General", icon: FiPackage, path: ROUTES.STOCK, module: "stock_general" },
      { name: "Alertas", icon: FiBell, path: ROUTES.ALERTAS, module: "alertas" },
      { name: "Proveedores", icon: FiTruck, path: ROUTES.PROVEEDORES, module: "proveedores" },
    ],
  },
  {
    section: "PRODUCCIÓN",
    collapsible: true,
    items: [
      { name: "Silos", icon: FiDatabase, path: ROUTES.SILOS, module: "silos" },
      { name: "Insumos", icon: FiArchive, path: ROUTES.INSUMOS, module: "insumos" },
      { name: "Fórmulas", icon: FiLayers, path: ROUTES.FORMULAS, module: "formulas" },
      { name: "Órdenes", icon: FiLayers, path: ROUTES.ORDENES, module: "ordenes"},
      { name: "Costos", icon: FiBarChart2, path: ROUTES.COSTOS, module: "finanzas" },
      { name: "Estados financieros", icon: FiBarChart2, path: ROUTES.ESTADOS_FINANCIEROS, module: "finanzas" },
      { name: "Tesorería", icon: FiDollarSign, path: ROUTES.TESORERIA, module: "tesoreria" },
      { name: "Trazabilidad", icon: FiGitMerge, path: ROUTES.TRAZABILIDAD, module: "trazabilidad" },
    ],
  },
  {
    section: "INVENTARIO",
    collapsible: true,
    items: [
      { name: "Stock Materia Prima", icon: FiInbox, path: ROUTES.STOCKMATERIAPRIMA, module: "stock_mp" },
      { name: "Stock de Productos Terminados", icon: FiPackage, path: ROUTES.PRODUCTOS, module: "productos" },
    ],
  },
  {
    section: "ADMINISTRACIÓN",
    collapsible: false,
    items: [
      { name: "Usuarios", icon: FiUsers, path: ROUTES.USUARIOS, module: "usuarios" },
    ],
  },
  // ... resto de secciones (puedes añadir los paths que necesites)
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getSessionUser();
  const { canAccess } = usePermissions();
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
    <aside className="w-full lg:w-[230px] lg:h-screen bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col overflow-hidden lg:sticky top-0">
      
      {/* LOGO: Se mantiene fijo arriba */}
      <div className="px-4 md:px-5 py-4 md:py-5 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <BrandLogo variant="icon" className="lg:hidden shrink-0" />
          <BrandLogo variant="full" className="hidden lg:inline-flex max-w-[150px]" />
          <div className="hidden lg:block">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Producción e Inventario</p>
          </div>
        </div>
      </div>

      {/* CAMBIO 2: Este contenedor ahora es el que scrollea independientemente */}
      <div className="max-h-[45vh] lg:max-h-none flex-1 overflow-y-auto custom-scrollbar px-3 py-3 lg:py-4 space-y-4 lg:space-y-5">
        {menuItems.map((group) => {
          const visibleItems = group.items.filter((item) => canAccess(item.module, "view"));
          if (visibleItems.length === 0) return null;
          const isOpen = openSections.includes(group.section);
          return (
            <div key={group.section}>
              <button
                onClick={() => group.collapsible && toggleSection(group.section)}
                aria-label={`Alternar sección ${group.section}`}
                className="w-full flex items-center justify-between px-3 mb-2"
              >
                <p className="text-[10px] tracking-[0.25em] uppercase text-slate-500 font-semibold text-left">
                  {group.section}
                </p>
                {group.collapsible && (
                  <div className="text-slate-500">
                    {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  </div>
                )}
              </button>

              {(!group.collapsible || isOpen) && (
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                      <NavLink
                        key={item.name}
                        to={item.path || "#"}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                          ${isActive 
                              ? "bg-blue-50 text-blue-700" 
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}
                        `}
                      >
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center
                          ${isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}
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
      <div className="p-3 border-t border-slate-200 flex-shrink-0">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
            <div className="flex-1">
              <h4 className="font-medium text-[13px]">{currentUser.name}</h4>
              <p className="text-[11px] text-slate-500">{currentUser.roleLabel}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar sesión"
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition"
            >
              <FiLogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
