import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { MainLayout } from '../../shared/layouts/MainLayout';
import { isAuthenticated } from '../../features/auth/session';
import type { AppModule } from '../../features/auth/permissions';
import { usePermissions } from '../../features/auth/usePermissions';

const DashboardPage = lazy(() => import('../../features/dashboard/pages/DashboardExecutivePage'));
import DashboardOperativoPage from '../../features/dashboard/pages/DashboardOperativoPage';
const InsumoPage = lazy(() => import('../../features/insumos/pages/InsumoPage'));
const ProveedorPage = lazy(() => import('../../features/proveedores/pages/ProveedorPage'));
const StockMateriaPrimaPage = lazy(() => import('../../features/insumos/pages/StockMateriaPrimaPage'));
const SiloPage = lazy(() => import('../../features/silos/pages/SiloPage'));
const FormulaPage = lazy(() => import('../../features/formulas/pages/FormulaPage'));
const OrdenPage = lazy(() => import('../../features/ordenes/pages/OrdenPage'));
const OrdenesSalidaPage = lazy(() => import('../../features/ordenes/pages/OrdenesSalidaPage'));
const ClientesPage = lazy(() => import('../../features/clientes/pages/ClientesPage'));
const ProductosPage = lazy(() => import('../../features/productos/pages/ProductosPage'));
const CostosPage = lazy(() => import('../../features/costos/pages/CostosPage'));
const EstadosFinancierosPage = lazy(() => import('../../features/finanzas/pages/EstadosFinancierosPage'));
const PresupuestosPage = lazy(() => import('../../features/finanzas/pages/PresupuestosPage'));
const MovimientosFinancierosPage = lazy(() => import('../../features/finanzas/pages/MovimientosFinancierosPage'));
const ProyeccionCajaPage = lazy(() => import('../../features/finanzas/pages/ProyeccionCajaPage'));
const ComprobantesPage = lazy(() => import('../../features/finanzas/pages/ComprobantesPage'));
const TesoreriaPage = lazy(() => import('../../features/tesoreria/pages/TesoreriaPage'));
const StockGeneralPage = lazy(() => import('../../features/inventario/pages/StockGeneralPage'));
const TrazabilidadPage = lazy(() => import('../../features/trazabilidad/pages/TrazabilidadPage'));
const AlertasPage = lazy(() => import('../../features/alertas/pages/AlertasPage'));
const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'));
const UsuariosPage = lazy(() => import('../../features/usuarios/pages/UsuariosPage'));

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
          <Route path={ROUTES.ORDENES_SALIDA} element={<ModuleRoute module="ordenes"><OrdenesSalidaPage /></ModuleRoute>} />
          <Route path="/Ordenes" element={<Navigate to={ROUTES.ORDENES} replace />} />
          <Route path={ROUTES.CLIENTES} element={<ModuleRoute module="clientes"><ClientesPage /></ModuleRoute>} />
          <Route path={ROUTES.STOCK} element={<ModuleRoute module="stock_general"><StockGeneralPage /></ModuleRoute>} />
          <Route path={ROUTES.ALERTAS} element={<ModuleRoute module="alertas"><AlertasPage /></ModuleRoute>} />
          <Route path={ROUTES.TRAZABILIDAD} element={<ModuleRoute module="trazabilidad"><TrazabilidadPage /></ModuleRoute>} />
          <Route path={ROUTES.PRODUCTOS} element={<ModuleRoute module="productos"><ProductosPage /></ModuleRoute>} />
          <Route path={ROUTES.COSTOS} element={<ModuleRoute module="finanzas"><CostosPage /></ModuleRoute>} />
          <Route path={ROUTES.MOVIMIENTOS_FINANCIEROS} element={<ModuleRoute module="finanzas"><MovimientosFinancierosPage /></ModuleRoute>} />
          <Route path={ROUTES.PRESUPUESTOS} element={<ModuleRoute module="finanzas"><PresupuestosPage /></ModuleRoute>} />
          <Route path={ROUTES.ESTADOS_FINANCIEROS} element={<ModuleRoute module="finanzas"><EstadosFinancierosPage /></ModuleRoute>} />
          <Route path={ROUTES.PROYECCION_CAJA} element={<ModuleRoute module="finanzas"><ProyeccionCajaPage /></ModuleRoute>} />
          <Route path={ROUTES.COMPROBANTES} element={<ModuleRoute module="finanzas"><ComprobantesPage /></ModuleRoute>} />
          <Route path={ROUTES.TESORERIA} element={<ModuleRoute module="tesoreria"><TesoreriaPage /></ModuleRoute>} />
          <Route path={ROUTES.USUARIOS} element={<ModuleRoute module="usuarios"><UsuariosPage /></ModuleRoute>} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated() ? ROUTES.DASHBOARD : ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
