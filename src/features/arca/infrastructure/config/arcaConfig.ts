export type ArcaMode = 'SIMULACION' | 'REAL';

export interface ArcaConfig {
  mode: ArcaMode;
  enabledModalities: {
    FACTURA_B: boolean;
    FACTURA_A: boolean;
    FACTURA_MIXTA: boolean;
  };
  simulation: {
    allowDrafts: boolean;
    autoAcceptB: boolean;
    defaultIvaRate: number;
  };
  credentials: {
    present: boolean;
    environment: 'none' | 'sandbox' | 'production';
  };
}

export const ARCA_CONFIG = {
  mode: 'SIMULACION',
  enabledModalities: {
    FACTURA_B: true,
    FACTURA_A: false,
    FACTURA_MIXTA: false,
  },
  simulation: {
    allowDrafts: true,
    autoAcceptB: true,
    defaultIvaRate: 0.21,
  },
  credentials: {
    present: false,
    environment: 'none',
  },
} as const satisfies ArcaConfig;
