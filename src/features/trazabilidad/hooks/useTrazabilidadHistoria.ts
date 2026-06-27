import { useEffect, useMemo, useState } from 'react';
import { ApiService } from '../../../infrastructure/api';
import type { Cliente } from '../../clientes/types/cliente';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import type { OrdenExpedicion, OrdenProduccion } from '../../ordenes/types';
import type { MovimientoStockPT } from '../../productos/types';
import type { Proveedor } from '../../proveedores/types/proveedor';
import type { SentidoTrazabilidad, TrazabilidadHistoriaResultado, TrazabilidadPorOP } from '../types';
import { buildTrazabilidadHistoria } from '../utils/trazabilidadHistoria';

export const useTrazabilidadHistoria = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lotes, setLotes] = useState<StockMateriaPrima[]>([]);
const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [trazabilidadOP, setTrazabilidadOP] = useState<TrazabilidadPorOP[]>([]);
  const [movimientosPT, setMovimientosPT] = useState<MovimientoStockPT[]>([]);
  const [expediciones, setExpediciones] = useState<OrdenExpedicion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  const [sentido, setSentido] = useState<SentidoTrazabilidad>('ADELANTE');
  const [loteInsumo, setLoteInsumo] = useState('');
  const [producto, setProducto] = useState('');
  const [venta, setVenta] = useState('');
  const [cliente, setCliente] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [
          lotesData,
          insumosData,
          ordenesData,
          trazabilidadData,
          movimientosData,
          expedicionesData,
          clientesData,
          proveedoresData,
        ] = await Promise.all([
          ApiService.stockMP.getAllLotes(),
          ApiService.insumos.getAllInsumos(),
          ApiService.ordenes.getAll(),
          ApiService.trazabilidad.getTrazabilidadPorOP(),
          ApiService.stockPT.getMovimientos(),
          ApiService.ordenesExpedicion.getAll(),
          ApiService.clientes.getAll(),
          ApiService.proveedores.getAll(),
        ]);
        setLotes(lotesData);
        setInsumos(insumosData);
        setOrdenes(ordenesData);
        setTrazabilidadOP(trazabilidadData);
        setMovimientosPT(movimientosData);
        setExpediciones(expedicionesData);
        setClientes(clientesData);
        setProveedores(proveedoresData);
        setError(null);
      } catch {
        setError('No pudimos cargar el historial de trazabilidad.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const lotesOptions = useMemo(
    () => [...lotes]
      .sort((a, b) => new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime())
      .map((lote) => ({
        id: lote.uid,
        value: lote.lote,
        label: `${lote.lote} · ${insumos.find((insumo) => insumo.uid === lote.id_insumo)?.nombre ?? lote.id_insumo}`,
      })),
    [insumos, lotes],
  );

  const productosOptions = useMemo(
    () => [...new Set([
      ...ordenes.map((orden) => orden.nombre_producto),
      ...movimientosPT.map((mov) => mov.nombre_producto),
      ...expediciones.map((exp) => exp.nombre_producto),
    ])].filter(Boolean).sort().map((value, index) => ({ id: `producto-${index}`, value, label: value })),
    [expediciones, movimientosPT, ordenes],
  );

  const ventaOptions = useMemo(
    () => expediciones.map((exp, index) => ({
      id: `${exp.numero_expedicion ?? 'venta'}-${index}`,
      value: exp.numero_expedicion,
      label: `${exp.numero_expedicion} · ${exp.nombre_producto} · ${exp.cliente_nombre ?? 'Sin cliente'}`,
    })),
    [expediciones],
  );

  const clienteOptions = useMemo(
    () => clientes.map((item, index) => ({ id: item.uid ?? `cliente-${index}`, value: item.nombre, label: item.nombre })),
    [clientes],
  );

  const resultado = useMemo<TrazabilidadHistoriaResultado | null>(
    () => buildTrazabilidadHistoria(
      { sentido, loteInsumo, producto, venta, cliente, fechaDesde, fechaHasta },
      { lotes, insumos, ordenes, trazabilidadOP, movimientosPT, expediciones, clientes, proveedores },
    ),
    [cliente, clientes, expediciones, fechaDesde, fechaHasta, insumos, loteInsumo, lotes, movimientosPT, ordenes, producto, proveedores, sentido, trazabilidadOP, venta],
  );

  const resetFilters = () => {
    setLoteInsumo('');
    setProducto('');
    setVenta('');
    setCliente('');
    setFechaDesde('');
    setFechaHasta('');
  };

  return {
    loading,
    error,
    sentido,
    setSentido,
    loteInsumo,
    setLoteInsumo,
    producto,
    setProducto,
    venta,
    setVenta,
    cliente,
    setCliente,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    lotesOptions,
    productosOptions,
    ventaOptions,
    clienteOptions,
    resultado,
    resetFilters,
  };
};
