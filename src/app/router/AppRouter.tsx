import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { MainLayout } from '../../shared/layouts/MainLayout';
import { isAuthenticated } from '../../features/auth/session';

// Usamos importación directa para estar seguros, luego puedes volver a lazy
import DashboardPage from '../../features/dashboard/pages/DashboardPage';
import InsumoPage from '../../features/insumos/pages/InsumoPage';
import ProveedorPage from '../../features/proveedores/pages/ProveedorPage';
import StockMateriaPrimaPage from '../../features/insumos/pages/StockMateriaPrimaPage';
import SiloPage from '../../features/silos/pages/SiloPage';
import FormulaPage from '../../features/formulas/pages/FormulaPage';
import OrdenPage from '../../features/ordenes/pages/OrdenPage';
import ClientesPage from '../../features/clientes/pages/ClientesPage';
import ProductosPage from '../../features/productos/pages/ProductosPage';
import CostosPage from '../../features/costos/pages/CostosPage';
import LoginPage from '../../features/auth/pages/LoginPage';

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
          <Route index element={<DashboardPage />} /> 
          
          {/* Ruta de Insumos Real */}
          <Route path={ROUTES.INSUMOS} element={<InsumoPage />} /> 
          <Route path={ROUTES.PROVEEDORES} element={<ProveedorPage />} /> 
          <Route path={ROUTES.STOCKMATERIAPRIMA} element={<StockMateriaPrimaPage />} />
          <Route path={ROUTES.SILOS} element= {<SiloPage />} />
          <Route path={ROUTES.FORMULAS} element={<FormulaPage />} />
          <Route path={ROUTES.ORDENES} element={<OrdenPage />} />
          <Route path={ROUTES.CLIENTES} element={<ClientesPage />} />
          <Route path={ROUTES.PRODUCTOS} element={<ProductosPage />} />
          <Route path={ROUTES.COSTOS} element={<CostosPage />} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated() ? ROUTES.DASHBOARD : ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
