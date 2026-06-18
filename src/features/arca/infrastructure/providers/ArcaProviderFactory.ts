import { ARCA_CONFIG, type ArcaConfig } from '../config/arcaConfig';
import type { ArcaProvider } from '../../application/ports/ArcaProvider';
import type { ClockPort } from '../../application/ports/ClockPort';
import type { IdGeneratorPort } from '../../application/ports/IdGeneratorPort';
import { ArcaRealProvider } from './ArcaRealProvider';
import { ArcaSimulationProvider } from './ArcaSimulationProvider';

export const createArcaProvider = (
  config: ArcaConfig = ARCA_CONFIG,
  deps: {
    clock?: ClockPort;
    idGenerator?: IdGeneratorPort;
  } = {},
): ArcaProvider => {
  if (config.mode === 'SIMULACION') {
    return new ArcaSimulationProvider(config, deps);
  }

  return new ArcaRealProvider(config);
};
