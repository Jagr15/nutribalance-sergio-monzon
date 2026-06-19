import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { MainLayout } from '../../shared/layouts/MainLayout';
import { isAuthenticated } from '../../features/auth/session';
import type { AppModule } from '../../features/auth/permissions';
import { usePermissions } from '../../features/auth/usePermissions';

// Usamos importación directa para estar seguros, luego puedes volver a lazy
import DashboardPage from '../../features/dashboard/pages/DashboardExecutivePage';
import DashboardOperativoPage from '../../features/dashboard/pages/DashboardOperativoPage';
import InsumoPage from '../../features/insumos/pages/InsumoPage';
import ProveedorPage from '../../features/proveedores/pages/ProveedorPage';
import StockMateriaPrimaPage from '../../features/insumos/pages/StockMateriaPrimaPage';
import SiloPage from '../../features/silos/pages/SiloPage';
import FormulaPage from '../../features/formulas/pages/FormulaPage';
import OrdenPage from '../../features/ordenes/pages/OrdenPage';
import ClientesPage from '../../features/clientes/pages/ClientesPage';
import ProductosPage from '../../features/productos/pages/ProductosPage';
import CostosPage from '../../features/costos/pages/CostosPage';
import EstadosFinancierosPage from '../../features/finanzas/pages/EstadosFinancierosPage';
import TesoreriaPage from '../../features/tesoreria/pages/TesoreriaPage';
import StockGeneralPage from '../../features/inventario/pages/StockGeneralPage';
import TrazabilidadPage from '../../features/trazabilidad/pages/TrazabilidadPage';
import AlertasPage from '../../features/alertas/pages/AlertasPage';
import LoginPage from '../../features/auth/pages/LoginPage';
import UsuariosPage from '../../features/usuarios/pages/UsuariosPage';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }
  return children;
};

const GuestRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  if (isAuthenticated()) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  return children;
};

const ModuleRoute: React.FC<{ module: AppModule; children: React.ReactElement }> = ({ module, children }) => {
  const { canAccess } = usePermissions();
  if (!canAccess(module, 'view')) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  return children;
};

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<div className="loading-screen">Cargando NutriBalance...</div>}>
      <Routes>
        <Route
          path={ROUTES.LOGIN}
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* Ruta base */}
          <Route index element={<ModuleRoute module="dashboard"><DashboardPage /></ModuleRoute>} /> 
          <Route path={ROUTES.DASHBOARD_OPERATIVO} element={<ModuleRoute module="dashboard"><DashboardOperativoPage /></ModuleRoute>} />
          
          {/* Ruta de Insumos Real */}
          <Route path={ROUTES.INSUMOS} element={<ModuleRoute module="insumos"><InsumoPage /></ModuleRoute>} /> 
          <Route path={ROUTES.PROVEEDORES} element={<ModuleRoute module="proveedores"><ProveedorPage /></ModuleRoute>} /> 
          <Route path={ROUTES.STOCKMATERIAPRIMA} element={<ModuleRoute module="stock_mp"><StockMateriaPrimaPage /></ModuleRoute>} />
          <Route path={ROUTES.SILOS} element= {<ModuleRoute module="silos"><SiloPage /></ModuleRoute>} />
          <Route path={ROUTES.FORMULAS} element={<ModuleRoute module="formulas"><FormulaPage /></ModuleRoute>} />
          <Route path={ROUTES.ORDENES} element={<ModuleRoute module="ordenes"><OrdenPage /></ModuleRoute>} />
          <Route path="/Ordenes" element={<Navigate to={ROUTES.ORDENES} replace />} />
          <Route path={ROUTES.CLIENTES} element={<ModuleRoute module="clientes"><ClientesPage /></ModuleRoute>} />
          <Route path={ROUTES.STOCK} element={<ModuleRoute module="stock_general"><StockGeneralPage /></ModuleRoute>} />
          <Route path={ROUTES.ALERTAS} element={<ModuleRoute module="alertas"><AlertasPage /></ModuleRoute>} />
          <Route path={ROUTES.TRAZABILIDAD} element={<ModuleRoute module="trazabilidad"><TrazabilidadPage /></ModuleRoute>} />
          <Route path={ROUTES.PRODUCTOS} element={<ModuleRoute module="productos"><ProductosPage /></ModuleRoute>} />
          <Route path={ROUTES.COSTOS} element={<ModuleRoute module="finanzas"><CostosPage /></ModuleRoute>} />
          <Route path={ROUTES.ESTADOS_FINANCIEROS} element={<ModuleRoute module="finanzas"><EstadosFinancierosPage /></ModuleRoute>} />
          <Route path={ROUTES.TESORERIA} element={<ModuleRoute module="tesoreria"><TesoreriaPage /></ModuleRoute>} />
          <Route path={ROUTES.USUARIOS} element={<ModuleRoute module="usuarios"><UsuariosPage /></ModuleRoute>} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated() ? ROUTES.DASHBOARD : ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
