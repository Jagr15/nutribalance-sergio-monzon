import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { MainLayout } from '../../shared/layouts/MainLayout';

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

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<div className="loading-screen">Cargando NutriBalance...</div>}>
      <Routes>
        <Route element={<MainLayout />}>
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
