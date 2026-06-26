import { contabilidadOperativaService } from '../../finanzas/services/contabilidadOperativaService';

export type MovimientoCostoOrigen = 'COBRANZA' | 'VENTA_PT' | 'EGRESO_OPERATIVO' | 'OTRO';

export interface MovimientoCostoSyncPayload {
  origen_id: string;
  fecha: string;
  tipo: 'INGRESO' | 'EGRESO';
  descripcion: string;
  monto: number;
  origen_operativo: MovimientoCostoOrigen | string;
  categoria_id?: string | null;
  centro_costo_id?: string | null;
  estado?: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
  metadata?: Record<string, unknown>;
}

const clean = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildLegacyUid = (origenId: string) => `fcm-costos-${clean(origenId)}`;

const buildMetadata = (origenId: string, metadata?: Record<string, unknown>) => ({
  ...(metadata ?? {}),
  origen_modulo: 'costos',
  origen_id: clean(origenId),
});

export const costosContabilidadService = {
  async sincronizarMovimiento(payload: MovimientoCostoSyncPayload): Promise<void> {
    const origenId = clean(payload.origen_id);
    if (!origenId) throw new Error('El origen de costos es obligatorio.');
    if (!payload.descripcion.trim()) throw new Error('La descripción del movimiento de costos es obligatoria.');
    if (!Number.isFinite(payload.monto) || payload.monto <= 0) throw new Error('El monto del movimiento de costos debe ser mayor a 0.');

    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: buildLegacyUid(origenId),
      fecha: payload.fecha,
      tipo: payload.tipo,
      origen_operativo: clean(payload.origen_operativo),
      origen_modulo: 'costos',
      origen_id: origenId,
      descripcion: clean(payload.descripcion),
      monto: payload.monto,
      categoria_id: payload.categoria_id ?? null,
      centro_costo_id: payload.centro_costo_id ?? null,
      estado: payload.estado ?? 'CONFIRMADO',
      metadata: buildMetadata(origenId, payload.metadata),
    });
  },

  async anularMovimiento(payload: Omit<MovimientoCostoSyncPayload, 'tipo' | 'descripcion' | 'origen_operativo'> & {
    tipo?: 'INGRESO' | 'EGRESO';
    descripcion?: string;
    origen_operativo?: MovimientoCostoOrigen | string;
  }): Promise<void> {
    const origenId = clean(payload.origen_id);
    if (!origenId) throw new Error('El origen de costos es obligatorio.');
    if (!Number.isFinite(payload.monto) || payload.monto <= 0) throw new Error('El monto del movimiento de costos debe ser mayor a 0.');

    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: buildLegacyUid(origenId),
      fecha: payload.fecha,
      tipo: payload.tipo ?? 'EGRESO',
      origen_operativo: clean(payload.origen_operativo ?? 'COSTOS_ANULACION'),
      origen_modulo: 'costos',
      origen_id: origenId,
      descripcion: clean(payload.descripcion ?? `Anulación de movimiento de costos ${origenId}`),
      monto: payload.monto,
      categoria_id: payload.categoria_id ?? null,
      centro_costo_id: payload.centro_costo_id ?? null,
      estado: 'ANULADO',
      metadata: buildMetadata(origenId, { ...(payload.metadata ?? {}), accion: 'anulacion' }),
    });
  },
};
