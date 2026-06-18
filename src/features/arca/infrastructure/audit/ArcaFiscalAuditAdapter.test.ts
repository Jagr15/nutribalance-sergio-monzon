import { describe, expect, it, vi } from 'vitest';
import { ArcaFiscalAuditAdapter } from './ArcaFiscalAuditAdapter';

describe('ArcaFiscalAuditAdapter', () => {
  it('normaliza acciones de auditoria fiscal', async () => {
    const registrarEvento = vi.fn(async () => ({ id: 'evt-1', createdAt: '2026-06-17T12:00:00.000Z' }));
    const adapter = new ArcaFiscalAuditAdapter({ registrarEvento });

    await adapter.registrarIntentoBloqueado({
      estado: 'PENDIENTE_CREDENCIALES',
      providerMode: 'SIMULACION',
      mensaje: 'Bloqueado',
      payload: { modalidad: 'FACTURA_A' },
    });

    expect(registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'INTENTO_BLOQUEADO',
        estado: 'PENDIENTE_CREDENCIALES',
        providerMode: 'SIMULACION',
        mensaje: 'Bloqueado',
      }),
    );
  });
});
