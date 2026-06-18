import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { EmitirFacturaResult } from '../dto/EmitirFacturaResult';

export interface ArcaProvider {
  emitirFactura: (input: EmitirFacturaInput) => Promise<EmitirFacturaResult>;
}
