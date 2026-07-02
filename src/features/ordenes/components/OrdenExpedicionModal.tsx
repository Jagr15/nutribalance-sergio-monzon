import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiTruck, FiPackage, FiUser, FiFileText } from 'react-icons/fi';
import { ApiService } from '../../../infrastructure/api';
import type { Cliente } from '../../clientes/types/cliente';
import type { StockProductoTerminado } from '../../productos/types';
import type { OrdenExpedicion, PresentacionExpedicionKey } from '../types';
import {
  buildPresentacionPersistencia,
  formatPresentacionResumen,
  getCantidadEntradaInicialFromOrder,
  getCantidadLabelFromPresentation,
  getKgRealesFromPresentation,
  getPresentacionExpedicionKeyFromOrder,
  getPresentacionExpedicionOption,
  PRESENTACION_EXPEDICION_OPTIONS,
} from '../utils/presentacionExpedicion';
import { normalizeNumericInputChange, parseNumericInput } from '../../../shared/utils/formatters';

interface Props {
  onClose: () => void;
  onSuccess?: () => Promise<void> | void;
  orden?: OrdenExpedicion | null;
}

const formatKg = (value: number) => `${value.toLocaleString('es-AR')} kg`;
const matchesStockSelection = (item: StockProductoTerminado, stockId: string) =>
  item.uid === stockId || item.id === stockId;

const OrdenExpedicionModal: React.FC<Props> = ({ onClose, onSuccess, orden = null }) => {
  const [stockPTAll, setStockPTAll] = useState<StockProductoTerminado[]>([]);
  const [stockPT, setStockPT] = useState<StockProductoTerminado[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedStockId, setSelectedStockId] = useState(orden?.stock_pt_id ?? '');
  const [selectedClienteId, setSelectedClienteId] = useState(orden?.cliente_id ?? '');
  const [selectedPresentacionKey, setSelectedPresentacionKey] = useState<PresentacionExpedicionKey>(() => getPresentacionExpedicionKeyFromOrder(orden));
  const [valorEntrada, setValorEntrada] = useState<string>(() => getCantidadEntradaInicialFromOrder(orden, getPresentacionExpedicionKeyFromOrder(orden)));
  const [motivo, setMotivo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [stockData, clientesData] = await Promise.all([
          ApiService.stockPT.getAll(),
          ApiService.clientes.getAll(),
        ]);
        setStockPTAll(stockData);
        const disponibles = stockData.filter((item) => Number(item.cantidad_total ?? 0) > 0);
        setStockPT(disponibles);
        setClientes(clientesData);
        setSelectedStockId((current) => {
          const stockInicial = orden
            ? stockData.find((item) => matchesStockSelection(item, orden.stock_pt_id))
            : null;
          if (orden) return stockInicial?.uid ?? current ?? disponibles[0]?.uid ?? '';
          if (current) return current;
          return disponibles[0]?.uid ?? '';
        });
        setSelectedClienteId((current) => current || (clientesData[0]?.uid ?? ''));
        if (orden) {
          const initialKey = getPresentacionExpedicionKeyFromOrder(orden);
          setSelectedPresentacionKey(initialKey);
          setValorEntrada(getCantidadEntradaInicialFromOrder(orden, initialKey));
          setMotivo(orden.motivo ?? '');
          setReferencia(orden.referencia ?? '');
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la información para expedición.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [orden]);

  const selectedStock = useMemo(
    () => stockPTAll.find((item) => matchesStockSelection(item, selectedStockId)) ?? null,
    [stockPTAll, selectedStockId]
  );
  const stockOptions = useMemo(() => {
    if (!orden || !selectedStock) return stockPT;
    if (stockPT.some((item) => matchesStockSelection(item, selectedStockId))) return stockPT;
    return [selectedStock, ...stockPT];
  }, [orden, selectedStock, selectedStockId, stockPT]);

  const isEditable = !orden || orden.estado === 'pendiente';
  const selectedPresentation = getPresentacionExpedicionOption(selectedPresentacionKey);
  const cantidadEntrada = parseNumericInput(valorEntrada) ?? 0;
  const kgReales = getKgRealesFromPresentation(selectedPresentacionKey, cantidadEntrada);
  const persistenciaPresentacion = buildPresentacionPersistencia(selectedPresentacionKey, cantidadEntrada);
  const cantidadCantidadLabel = getCantidadLabelFromPresentation(selectedPresentacionKey);
  const stockDisponibleParaEdicion = selectedStock
    ? Number(selectedStock.cantidad_total ?? 0) + (orden ? Number(orden.cantidad_kg ?? orden.cantidad ?? 0) : 0)
    : 0;
  const guardarBloqueado = !selectedStock || !selectedClienteId || isSubmitting || !isEditable;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError(null);

    if (!selectedStock) {
      setError('Seleccioná un producto terminado disponible.');
      return;
    }
    if (!isEditable) {
      setError('La orden ya no puede editarse.');
      return;
    }
    if (!selectedClienteId) {
      setError('Seleccioná un cliente destino.');
      return;
    }
    if (cantidadEntrada <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (kgReales <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (kgReales > stockDisponibleParaEdicion) {
      setError('La cantidad no puede superar el stock disponible.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        stock_pt_id: selectedStock.uid,
        cliente_id: selectedClienteId,
        presentacion_key: selectedPresentacionKey,
        ...persistenciaPresentacion,
        cantidad_empaques: persistenciaPresentacion.cantidad_empaques,
        cantidad: kgReales,
        cantidad_original: kgReales,
        unidad_cantidad: 'kg' as const,
        motivo: motivo.trim() || undefined,
        referencia: referencia.trim() || undefined,
      } as const;
      if (orden) await ApiService.ordenesExpedicion.update(orden.id, payload);
      else await ApiService.ordenesExpedicion.create(payload);
      await onSuccess?.();
      onClose();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'No se pudo registrar la orden de expedición.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-slate-700 shadow-xl">
          Cargando datos de expedición...
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-500">Órdenes de Expedición</p>
            <h3 className="text-xl font-black text-slate-900">{orden ? 'Editar orden de expedición' : 'Nueva orden de expedición'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <FiX size={18} />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="ml-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Producto terminado</span>
              <select
                value={selectedStockId}
                onChange={(e) => setSelectedStockId(e.target.value)}
                disabled={!isEditable}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                {stockOptions.map((item) => (
                  <option key={item.id} value={item.uid}>
                    {item.nombre_producto} · {item.lote} · {formatKg(Number(item.cantidad_total ?? 0))}
                  </option>
                ))}
              </select>
              {stockPT.length === 0 ? (
                <p className="text-xs text-amber-600">No hay stock PT disponible para expedir.</p>
              ) : null}
            </label>

            <label className="space-y-2">
              <span className="ml-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Cliente destino</span>
              <select
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
                disabled={!isEditable}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.uid} value={cliente.uid}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
              {clientes.length === 0 ? (
                <p className="text-xs text-amber-600">No hay clientes disponibles.</p>
              ) : null}
            </label>
          </div>

          {selectedStock ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Detalle del lote</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedStock.nombre_producto}</p>
                  <p className="text-xs text-slate-500">OP / lote: {selectedStock.numero_orden} · {selectedStock.lote}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Saldo disponible</p>
                  <p className="mt-1 font-bold text-cyan-700">{formatKg(Number(selectedStock.cantidad_total ?? 0))}</p>
                </div>
              </div>
            </div>
          ) : null}

          {orden && !isEditable ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Esta orden no se puede editar porque está {orden.estado}.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiTruck size={12} /> Presentación
              </span>
              <select
                value={selectedPresentacionKey}
                onChange={(e) => {
                  const nextOption = getPresentacionExpedicionOption(e.target.value);
                  setSelectedPresentacionKey(nextOption.key);
                  setValorEntrada('');
                }}
                disabled={!isEditable}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                {PRESENTACION_EXPEDICION_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiPackage size={12} /> {cantidadCantidadLabel}
              </span>
              <input
                type="number"
                min="0"
                step={selectedPresentation.key === 'GRANEL_KG' || selectedPresentation.key === 'TONELADA' ? '0.001' : '1'}
                value={valorEntrada}
                onChange={(e) => setValorEntrada(normalizeNumericInputChange(e.target.value))}
                disabled={!isEditable}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <p className="text-xs text-slate-500">
                {selectedPresentation.key === 'GRANEL_KG'
                  ? `Se guardará como ${formatKg(kgReales)} en inventario`
                  : selectedPresentation.key === 'TONELADA'
                    ? `${cantidadEntrada.toLocaleString('es-AR')} toneladas = ${formatKg(kgReales)} en inventario`
                    : `${cantidadEntrada.toLocaleString('es-AR')} ${selectedPresentation.tipo === 'BOLSA' ? 'bolsas' : 'big bags'} x ${selectedPresentation.capacidadKg} kg = ${formatKg(kgReales)} en inventario`}
              </p>
            </label>

            <label className="space-y-2">
              <span className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiFileText size={12} /> Referencia
              </span>
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                disabled={!isEditable}
                placeholder="Remito, factura o nota"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            {formatPresentacionResumen(selectedPresentacionKey, cantidadEntrada, kgReales).map((item) => (
              <div key={item.label}>
                <strong>{item.label}:</strong> {item.value}
              </div>
            ))}
          </div>

          <label className="space-y-2">
            <span className="ml-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Motivo opcional</span>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={!isEditable}
              placeholder="Despacho comercial, prueba, ajuste..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <FiUser size={14} className="text-cyan-600" />
              Cliente requerido para registrar la expedición
            </span>
            <span className="font-semibold text-slate-900">
              {selectedStock ? `${selectedStock.nombre_producto} · ${selectedStock.lote}` : 'Sin stock'}
            </span>
          </div>
        </div>

        <footer className="flex gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardarBloqueado}
            onClick={handleSubmit}
            className="flex-[2] rounded-xl bg-cyan-600 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-cyan-900/20 transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : orden ? 'Guardar cambios' : 'Guardar expedición'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default OrdenExpedicionModal;
