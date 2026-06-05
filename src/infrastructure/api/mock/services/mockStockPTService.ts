import type { StockProductoTerminado } from '../../../../features/productos/types';
import { ControlEstado } from '../../../../features/productos/types';
import { mockApiCall } from '../mockClient';

const stockPTMock: StockProductoTerminado[] = [
  {
    uid: 'pt-001',
    id_orden: 'OP-PLD-001',
    numero_orden: 'OP-PLD-001',
    nombre_producto: 'Lechera 13% PB alta energia',
    cantidad_total: 1800,
    lote: 'PT-LE13-2605-A',
    unidad_medida: 'KG',
    estado: ControlEstado.OK,
    id_silo: 'silo-001',
    nombre_silo: 'Silo Lechera',
    detalle_insumos: {
      id_lote: 'I-3-2605-A',
      nombre_lote: 'I-3-2605-A',
      id_insumo: 'i-3',
      nombre_insumo: 'Maíz',
      cantidad: 975,
      unidad_medida: 'KG',
    },
    fecha_ingreso: '2026-05-26T09:00:00Z',
    usuario: 'Sergio Monzón',
    updateAt: '2026-05-26T12:00:00Z',
  },
  {
    uid: 'pt-002',
    id_orden: 'OP-PLD-002',
    numero_orden: 'OP-PLD-002',
    nombre_producto: 'Lechera 18% PB',
    cantidad_total: 1200,
    lote: 'PT-LE18-2605-B',
    unidad_medida: 'KG',
    estado: ControlEstado.BAJO,
    id_silo: 'silo-002',
    nombre_silo: 'Silo Producción 2',
    detalle_insumos: {
      id_lote: 'I-11-2605-A',
      nombre_lote: 'I-11-2605-A',
      id_insumo: 'i-11',
      nombre_insumo: 'Cáscara de Soja',
      cantidad: 729,
      unidad_medida: 'KG',
    },
    fecha_ingreso: '2026-05-27T11:30:00Z',
    usuario: 'Operador Planta',
    updateAt: '2026-05-27T14:10:00Z',
  },
  {
    uid: 'pt-003',
    id_orden: 'OP-PLD-003',
    numero_orden: 'OP-PLD-003',
    nombre_producto: 'Engorde Smart',
    cantidad_total: 480,
    lote: 'PT-ENGS-2605-C',
    unidad_medida: 'KG',
    estado: ControlEstado.CRITICO,
    id_silo: 'silo-003',
    nombre_silo: 'Silo Engorde',
    detalle_insumos: {
      id_lote: 'I-6-2605-A',
      nombre_lote: 'I-6-2605-A',
      id_insumo: 'i-6',
      nombre_insumo: 'Afrechillo',
      cantidad: 248,
      unidad_medida: 'KG',
    },
    fecha_ingreso: '2026-05-28T10:00:00Z',
    usuario: 'Sergio Monzón',
    updateAt: '2026-05-28T10:35:00Z',
  },
];

export const mockStockPTService = {
  getAll: async (): Promise<StockProductoTerminado[]> => {
    return mockApiCall([...stockPTMock], 450);
  },
};
