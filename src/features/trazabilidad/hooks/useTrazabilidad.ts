import { useEffect, useMemo, useState } from 'react';
import { ApiService } from '../../../infrastructure/api';
import type { Cliente } from '../../clientes/types/cliente';
import type { Insumo } from '../../insumos/types';
import type { Proveedor } from '../../proveedores/types/proveedor';
import type { StockMateriaPrima } from '../../insumos/types';
import type { MovimientoStockPT } from '../../productos/types';
import type { OrdenProduccion } from '../../ordenes/types';
import type { TrazabilidadLoteInsumoResultado, TrazabilidadPorOP } from '../types';
import { buildTrazabilidadLoteInsumo } from '../utils/trazabilidadLoteInsumo';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';

export const useTrazabilidad = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lotes, setLotes] = useState<StockMateriaPrima[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [trazabilidadOP, setTrazabilidadOP] = useState<TrazabilidadPorOP[]>([]);
  const [movimientosPT, setMovimientosPT] = useState<MovimientoStockPT[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [selectedLoteUid, setSelectedLoteUid] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      try {
        const [
          lotesData,
          ordenesData,
          trazabilidadData,
          movimientosData,
          clientesData,
          proveedoresData,
          insumosData,
        ] = await Promise.all([
          ApiService.stockMP.getAllLotes(),
          ApiService.ordenes.getAll(),
          ApiService.trazabilidad.getTrazabilidadPorOP(),
          ApiService.stockPT.getMovimientos(),
          ApiService.clientes.getAll(),
          ApiService.proveedores.getAll(),
          ApiService.insumos.getAllInsumos(),
        ]);
        setLotes(lotesData);
        setInsumos(insumosData);
        setOrdenes(ordenesData);
        setTrazabilidadOP(trazabilidadData);
        setMovimientosPT(movimientosData);
        setClientes(clientesData);
        setProveedores(proveedoresData);
        setSelectedLoteUid((current) => current || lotesData[0]?.uid || '');
        setError(null);
      } catch {
        setError('No pudimos cargar la trazabilidad por lote en este momento.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const lotesOptions = useMemo(
    () =>
      [...lotes]
        .sort((a, b) => new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime())
        .map((lote) => ({
          id: lote.uid,
          uid: lote.uid,
          label: `${lote.lote} · ${insumos.find((insumo) => insumo.uid === lote.id_insumo)?.nombre ?? lote.id_insumo}`,
          secondary: `${formatDateDDMMYYYY(lote.fecha_ingreso)} · ${lote.cantidad_actual.toLocaleString('es-AR')} kg`,
        })),
    [insumos, lotes],
  );

  const selectedLote = useMemo(
    () => lotes.find((lote) => lote.uid === selectedLoteUid || lote.lote === selectedLoteUid) ?? null,
    [lotes, selectedLoteUid],
  );

  const insumoById = useMemo(() => {
    const map = new Map<string, string>();
    insumos.forEach((insumo) => map.set(insumo.uid, insumo.nombre));
    return map;
  }, [insumos]);

  const proveedoresById = useMemo(() => {
    const map = new Map<string, Proveedor>();
    proveedores.forEach((proveedor) => map.set(proveedor.uid, proveedor));
    return map;
  }, [proveedores]);

  const resultado = useMemo<TrazabilidadLoteInsumoResultado | null>(() => {
    if (!selectedLoteUid) return null;
    return buildTrazabilidadLoteInsumo(selectedLoteUid, {
      lotes,
      insumoById,
      proveedoresById,
      ordenes,
      trazabilidadOP,
      movimientosPT,
      clientes,
    });
  }, [clientes, insumoById, lotes, movimientosPT, ordenes, proveedoresById, selectedLoteUid, trazabilidadOP]);

  return {
    loading,
    error,
    lotesOptions,
    lotes,
    selectedLoteUid,
    setSelectedLoteUid,
    selectedLote,
    resultado,
  };
};
