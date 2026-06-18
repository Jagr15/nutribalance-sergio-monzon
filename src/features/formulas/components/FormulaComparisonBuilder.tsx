import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheckCircle, FiChevronDown, FiGitMerge, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { useFormulas } from '../hooks/useFormulas';
import { ApiService } from '../../../infrastructure/api';
import type { Formula, Ingrediente } from '../types';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import {
  buildFormulaCreatePayloadFromDraft,
  buildFormulaDraftSnapshot,
  compareFormulaDrafts,
  createEmptyFormulaDraft,
  getValidDraftIngredients,
  type FormulaDraftState,
} from '../utils/formulaComparisonBuilder';

interface Props {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const currentUser = { id: 'usr-101', name: 'Admin IAWARE' };

const money = (value: number | null) => (typeof value === 'number'
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value)
  : 'Sin costo');

const pct = (value: number | null, decimals = 2) => (typeof value === 'number' ? `${value.toFixed(decimals)}%` : 'Sin dato');

const badgeClass = (value: number | null) => {
  if (value === null || value === 0) return 'bg-slate-100 text-slate-600';
  return value > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700';
};

const badgeLabel = (value: number | null, positive: string, negative: string) => {
  if (value === null || value === 0) return 'sin diferencia';
  return value > 0 ? positive : negative;
};

interface DraftEditorProps {
  draft: FormulaDraftState;
  onChange: (draft: FormulaDraftState) => void;
  maestroInsumos: Insumo[];
  summary: Formula;
  title: string;
}

const DraftEditor: React.FC<DraftEditorProps> = ({ draft, onChange, maestroInsumos, summary, title }) => {
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChangeIngredient = (index: number, next: Partial<Ingrediente>) => {
    const updated = draft.ingredientes.map((ingredient, currentIndex) => (
      currentIndex === index ? { ...ingredient, ...next } : ingredient
    ));
    onChange({ ...draft, ingredientes: updated });
  };

  const handleSelectInsumo = (index: number, item: Insumo) => {
    const duplicate = draft.ingredientes.some((ingredient, currentIndex) => ingredient.id_insumo === item.uid && currentIndex !== index);
    if (duplicate) {
      setLocalError('Insumo ya presente en esta alternativa.');
      return;
    }

    setLocalError(null);
    handleChangeIngredient(index, { id_insumo: item.uid, nombre_insumo: item.nombre });
    setActiveDropdown(null);
  };

  return (
    <section className="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Borrador editable</h3>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...draft, esta_activa: !draft.esta_activa })}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${draft.esta_activa ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
          >
            <FiCheckCircle size={14} />
            {draft.esta_activa ? 'Activo' : 'Inactivo'}
          </button>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Nombre del producto</label>
          <input
            type="text"
            value={draft.nombre_producto}
            onChange={(event) => onChange({ ...draft, nombre_producto: event.target.value })}
            placeholder="NOMBRE DEL PRODUCTO"
            className="ui-input w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500/30"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Mezcla de insumos</label>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">{summary.ingredientes.length} insumos</span>
          </div>

          {localError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {localError}
            </div>
          ) : null}

          <div className="space-y-2">
            {draft.ingredientes.map((ingredient, index) => (
              <div key={`${draft.id}-${index}`} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDropdown(activeDropdown === index ? null : index);
                      setSearchTerm('');
                      setLocalError(null);
                    }}
                    className="ui-input flex w-full items-center justify-between rounded-xl px-4 py-2 text-left text-sm text-slate-700"
                  >
                    <span className="truncate">{ingredient.nombre_insumo || 'Seleccionar...'}</span>
                    <FiChevronDown size={12} className="text-slate-500" />
                  </button>

                  {activeDropdown === index ? (
                    <div className="absolute left-0 right-0 bottom-full z-20 mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-xl">
                      <div className="relative mb-2">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                        <input
                          autoFocus
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Buscar insumo..."
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-blue-500/40"
                        />
                      </div>
                      <div className="max-h-40 space-y-1 overflow-y-auto custom-scrollbar">
                        {maestroInsumos
                          .filter((item) => item.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((item) => (
                            <button
                              key={item.uid}
                              type="button"
                              onClick={() => handleSelectInsumo(index, item)}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-blue-600/15 hover:text-slate-900"
                            >
                              {item.nombre}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative w-24">
                  <input
                    type="number"
                    step="0.01"
                    value={ingredient.porcentaje}
                    onChange={(event) => handleChangeIngredient(index, { porcentaje: Number.parseFloat(event.target.value) || 0 })}
                    className="ui-input h-[40px] w-full rounded-xl px-3 pr-6 text-center text-sm font-black text-slate-900 outline-none focus:border-blue-500/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">%</span>
                </div>

                <button
                  type="button"
                  onClick={() => onChange({ ...draft, ingredientes: draft.ingredientes.filter((_, currentIndex) => currentIndex !== index) })}
                  className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...draft, ingredientes: [...draft.ingredientes, { id_insumo: '', nombre_insumo: '', porcentaje: 0 }] })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-50"
          >
            <FiPlus size={14} />
            Añadir insumo
          </button>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cálculo automático</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-slate-700">Proteína: <span className="font-bold text-blue-600">{typeof summary.proteina_calculada_pct === 'number' ? `${summary.proteina_calculada_pct.toFixed(2)}%` : 'Sin dato'}</span></div>
            <div className="text-slate-700">PB g/kg: <span className="font-bold text-blue-600">{typeof summary.proteina_calculada_pct === 'number' ? (summary.proteina_calculada_pct * 10).toFixed(1) : 'Sin dato'}</span></div>
            <div className="text-slate-700">Costo/kg: <span className="font-bold text-emerald-600">{typeof summary.costo_por_kg === 'number' ? summary.costo_por_kg.toFixed(4) : 'Sin costo'}</span></div>
            <div className="text-slate-700">Costo/ton: <span className="font-bold text-emerald-600">{typeof summary.costo_por_tonelada === 'number' ? summary.costo_por_tonelada.toFixed(2) : 'Sin costo'}</span></div>
            <div className="text-slate-700">Suma ingredientes: <span className="font-bold text-slate-900">{summary.ingredientes.reduce((acc, ingredient) => acc + (Number(ingredient.porcentaje) || 0), 0)}%</span></div>
            <div className="text-slate-700">Cantidad ingredientes: <span className="font-bold text-slate-900">{summary.ingredientes.length}</span></div>
          </div>

          {(summary.advertencias_nutricionales?.length || summary.advertencias_costos?.length) ? (
            <div className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">
              {summary.advertencias_nutricionales?.slice(0, 2).map((warning) => <p key={`n-${warning}`}>• {warning}</p>)}
              {summary.advertencias_costos?.slice(0, 2).map((warning) => <p key={`c-${warning}`}>• {warning}</p>)}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

const FormulaComparisonBuilder: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { create, isLoading } = useFormulas();
  const [maestroInsumos, setMaestroInsumos] = useState<Insumo[]>([]);
  const [maestroStock, setMaestroStock] = useState<StockMateriaPrima[]>([]);
  const [draftA, setDraftA] = useState<FormulaDraftState>(() => createEmptyFormulaDraft('a', 'A'));
  const [draftB, setDraftB] = useState<FormulaDraftState>(() => createEmptyFormulaDraft('b', 'B'));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState<'a' | 'b' | 'both' | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [insumos, lotes] = await Promise.all([
          ApiService.insumos.getAllInsumos(),
          ApiService.stockMP.getAllLotes(),
        ]);
        setMaestroInsumos(insumos);
        setMaestroStock(lotes);
        setCatalogError(null);
      } catch {
        setCatalogError('No se pudieron cargar insumos/stock para comparar alternativas.');
      }
    };

    fetchData();
  }, []);

  const environment = useMemo(() => ({
    maestroInsumos,
    maestroStock,
    currentUser,
  }), [maestroInsumos, maestroStock]);

  const snapshotA = useMemo(
    () => buildFormulaDraftSnapshot(draftA, environment, 'draft-a'),
    [draftA, environment]
  );

  const snapshotB = useMemo(
    () => buildFormulaDraftSnapshot(draftB, environment, 'draft-b'),
    [draftB, environment]
  );

  const comparison = useMemo(
    () => compareFormulaDrafts(draftA, draftB, environment),
    [draftA, draftB, environment]
  );

  const canSaveA = draftA.nombre_producto.trim() !== '' && getValidDraftIngredients(draftA).length > 0;
  const canSaveB = draftB.nombre_producto.trim() !== '' && getValidDraftIngredients(draftB).length > 0;
  const canSaveBoth = canSaveA && canSaveB;

  const Toast = useMemo(() => Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
    background: '#ffffff',
    color: '#0f172a',
    customClass: { popup: 'border border-slate-200 rounded-xl' }
  }), []);

  const saveDraft = async (target: 'a' | 'b') => {
    const draft = target === 'a' ? draftA : draftB;
    const payload = buildFormulaCreatePayloadFromDraft(draft, environment);
    const saved = await create(payload);
    Toast.fire({ icon: 'success', title: `${saved.nombre_producto} guardada` });
    return saved;
  };

  const saveSelected = async (target: 'a' | 'b' | 'both') => {
    if (catalogError) {
      setSubmitError(catalogError);
      return;
    }

    setSubmitError(null);
    setSavingTarget(target);

    try {
      if (target === 'a' || target === 'b') {
        await saveDraft(target);
        await onSuccess();
        onClose();
        return;
      }

      const results: Formula[] = [];
      try {
        results.push(await saveDraft('a'));
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'No se pudo guardar la fórmula A.');
      }

      try {
        results.push(await saveDraft('b'));
      } catch (error) {
        setSubmitError((current) => current ?? (error instanceof Error ? error.message : 'No se pudo guardar la fórmula B.'));
      }

      if (results.length > 0) {
        await onSuccess();
      }

      if (results.length === 2) {
        Toast.fire({ icon: 'success', title: 'Ambas fórmulas guardadas' });
        onClose();
      }
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudieron guardar las fórmulas.');
    } finally {
      setSavingTarget(null);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600">
              <FiGitMerge size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Comparar alternativas</h3>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dos borradores editables en vivo</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <FiX size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {submitError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}
          {catalogError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {catalogError}
            </div>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <DraftEditor
              title="Fórmula A"
              draft={draftA}
              onChange={setDraftA}
              maestroInsumos={maestroInsumos}
              summary={snapshotA}
            />

            <div className="hidden items-center justify-center lg:flex">
              <div className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">
                Comparación en vivo
              </div>
            </div>

            <DraftEditor
              title="Fórmula B"
              draft={draftB}
              onChange={setDraftB}
              maestroInsumos={maestroInsumos}
              summary={snapshotB}
            />
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h4 className="text-sm font-semibold text-slate-900">Comparación de resultados</h4>
            </div>

            {comparison.ingredientes.length === 0 ? (
              <div className="px-4 pb-4 text-sm text-slate-600">Agrega insumos para comparar.</div>
            ) : (
              <div className="space-y-4 px-4 pb-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr]">
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Fórmula A</p>
                    <h4 className="mt-2 text-base font-semibold text-slate-900">{comparison.formulaA.nombre_producto}</h4>
                    <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Versión</dt><dd>Sin versión</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Proteína fórmula</dt><dd>{pct(comparison.formulaA.proteina_formula)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">PB g/kg</dt><dd>{comparison.formulaA.pb_g_kg !== null ? comparison.formulaA.pb_g_kg.toFixed(1) : 'Sin dato'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/kg</dt><dd>{money(comparison.formulaA.costo_por_kg)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/ton</dt><dd>{money(comparison.formulaA.costo_por_tonelada)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Total ingredientes %</dt><dd>{pct(comparison.formulaA.total_ingredientes_pct)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Cantidad ingredientes</dt><dd>{comparison.formulaA.cantidad_ingredientes}</dd></div>
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">Diferencias B - A</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-800">
                      <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Costo/kg</p>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${badgeClass(comparison.diferencias.costo_por_kg)}`}>
                            {badgeLabel(comparison.diferencias.costo_por_kg, 'costo mayor', 'costo menor')}
                          </span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-slate-900">{money(comparison.diferencias.costo_por_kg)}</p>
                      </div>

                      <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Proteína %</p>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${badgeClass(comparison.diferencias.proteina_formula)}`}>
                            {badgeLabel(comparison.diferencias.proteina_formula, 'proteína mayor', 'proteína menor')}
                          </span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-slate-900">{pct(comparison.diferencias.proteina_formula)}</p>
                      </div>

                      <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">PB g/kg</p>
                        <p className="mt-2 text-lg font-bold text-slate-900">{comparison.diferencias.pb_g_kg !== null ? comparison.diferencias.pb_g_kg.toFixed(1) : 'Sin dato'}</p>
                      </div>

                      <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Costo/ton</p>
                        <p className="mt-2 text-lg font-bold text-slate-900">{money(comparison.diferencias.costo_por_tonelada)}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Fórmula B</p>
                    <h4 className="mt-2 text-base font-semibold text-slate-900">{comparison.formulaB.nombre_producto}</h4>
                    <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Versión</dt><dd>Sin versión</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Proteína fórmula</dt><dd>{pct(comparison.formulaB.proteina_formula)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">PB g/kg</dt><dd>{comparison.formulaB.pb_g_kg !== null ? comparison.formulaB.pb_g_kg.toFixed(1) : 'Sin dato'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/kg</dt><dd>{money(comparison.formulaB.costo_por_kg)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/ton</dt><dd>{money(comparison.formulaB.costo_por_tonelada)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Total ingredientes %</dt><dd>{pct(comparison.formulaB.total_ingredientes_pct)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Cantidad ingredientes</dt><dd>{comparison.formulaB.cantidad_ingredientes}</dd></div>
                    </dl>
                  </section>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h4 className="text-sm font-semibold text-slate-900">Comparación de ingredientes</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[960px] w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 text-left">Insumo</th>
                          <th className="px-4 py-3 text-right">% Fórmula A</th>
                          <th className="px-4 py-3 text-right">% Fórmula B</th>
                          <th className="px-4 py-3 text-right">Diferencia %</th>
                          <th className="px-4 py-3 text-right">Costo estimado A</th>
                          <th className="px-4 py-3 text-right">Costo estimado B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparison.ingredientes.map((row) => (
                          <tr key={row.id_insumo} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.nombre_insumo}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{pct(row.porcentaje_a)}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{pct(row.porcentaje_b)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${row.diferencia_pct > 0 ? 'text-emerald-700' : row.diferencia_pct < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                              {pct(row.diferencia_pct)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">{money(row.costo_estimado_a_kg)}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{money(row.costo_estimado_b_kg)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <button
              type="button"
              onClick={() => saveSelected('a')}
              disabled={isLoading || savingTarget !== null || !canSaveA}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingTarget === 'a' ? 'Guardando A...' : 'Guardar fórmula A'}
            </button>

            <button
              type="button"
              onClick={() => saveSelected('b')}
              disabled={isLoading || savingTarget !== null || !canSaveB}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingTarget === 'b' ? 'Guardando B...' : 'Guardar fórmula B'}
            </button>

            <button
              type="button"
              onClick={() => saveSelected('both')}
              disabled={isLoading || savingTarget !== null || !canSaveBoth}
              className="flex-[1.4] rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {savingTarget === 'both' ? 'Guardando ambas...' : 'Guardar ambas'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default FormulaComparisonBuilder;
