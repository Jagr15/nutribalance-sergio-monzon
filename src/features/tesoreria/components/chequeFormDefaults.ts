import type { ChequeTesoreriaFormValues } from '../services/tesoreriaService';

export const EMPTY_CHEQUE_FORM: ChequeTesoreriaFormValues = {
  numero: '',
  tipo: '',
  tercero: '',
  importe: 0,
  fecha_emision: '',
  fecha_vencimiento: '',
  estado: 'PENDIENTE',
  fecha_acreditacion: null,
  cliente_id: null,
  cliente_nombre: null,
};
