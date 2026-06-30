import type { ProductoUiLike } from '../types/empaquesProductoUi';
import { openConfiguracionEmpaquesModal } from './openConfiguracionEmpaquesModal';

export interface ProductoEmpaquesModalParams {
  producto?: ProductoUiLike;
  onRefresh?: () => Promise<void> | void;
}

export const openEmpaquesProductoModal = async (_params: ProductoEmpaquesModalParams = {}) => {
  await openConfiguracionEmpaquesModal(_params.onRefresh);
};
