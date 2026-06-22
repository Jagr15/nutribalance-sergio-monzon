import { useCallback, useEffect, useState } from 'react';
import { finanzasService } from '../../finanzas/services/finanzasService';
import type { FinanzasTesoreriaInsights } from '../../finanzas/types';
import type { EstadoChequeTesoreria } from '../../finanzas/types';
import type { ChequeTesoreriaFormValues } from '../services/tesoreriaService';
import { tesoreriaService } from '../services/tesoreriaService';

const EMPTY_TESORERIA: FinanzasTesoreriaInsights = {
  presupuestoVsReal: [],
  gastosPorRubro: [],
  variacionesPorRubro: [],
  carteraClientes: [],
  chequesEmitidos: [],
  chequesRecibidos: [],
  proyeccionFlujo: [],
  alertasTesoreria: [],
};

export const useTesoreria = () => {
  const [tesoreria, setTesoreria] = useState<FinanzasTesoreriaInsights>(EMPTY_TESORERIA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void finanzasService.getTreasuryInsights()
      .then((data) => {
        if (!mounted) return;
        setTesoreria(data);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setTesoreria(EMPTY_TESORERIA);
        setError(err instanceof Error ? err.message : 'No se pudo cargar la información de tesorería.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await finanzasService.getTreasuryInsights();
      setTesoreria(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la información de tesorería.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createCheque = useCallback(async (payload: ChequeTesoreriaFormValues) => {
    await tesoreriaService.createCheque(payload);
    await refresh();
  }, [refresh]);

  const updateCheque = useCallback(async (id: string, payload: ChequeTesoreriaFormValues) => {
    await tesoreriaService.updateCheque(id, payload);
    await refresh();
  }, [refresh]);

  const updateChequeEstado = useCallback(async (id: string, estado: EstadoChequeTesoreria) => {
    await tesoreriaService.updateChequeEstado(id, estado);
    await refresh();
  }, [refresh]);

  const getCheques = useCallback((params?: Parameters<typeof tesoreriaService.getCheques>[0]) => tesoreriaService.getCheques(params), []);

  return { tesoreria, loading, error, refresh, getCheques, createCheque, updateCheque, updateChequeEstado };
};
