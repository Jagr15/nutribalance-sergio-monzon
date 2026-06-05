import { useState } from 'react';

export const RegistrarMovimientoForm = ({ onSubmit }: { onSubmit: (payload: { tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA'; descripcion: string; monto: number; origen_operativo: string }) => Promise<void> }) => {
  const isTipo = (value: string): value is 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA' =>
    value === 'INGRESO' || value === 'EGRESO' || value === 'TRANSFERENCIA';
  const [tipo, setTipo] = useState<'INGRESO' | 'EGRESO' | 'TRANSFERENCIA'>('EGRESO');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('0');
  const [origen, setOrigen] = useState('MANUAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  return (
    <form
      className="grid grid-cols-1 md:grid-cols-5 gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setSubmitError(null);

        const descripcionLimpia = descripcion.trim();
        const montoNum = Number(monto);

        if (!descripcionLimpia) {
          setSubmitError('La descripción es obligatoria.');
          return;
        }
        if (!Number.isFinite(montoNum) || montoNum <= 0) {
          setSubmitError('El monto debe ser mayor a 0.');
          return;
        }

        try {
          setIsSubmitting(true);
          await onSubmit({ tipo, descripcion: descripcionLimpia, monto: montoNum, origen_operativo: origen });
          setDescripcion('');
          setMonto('0');
        } catch (error: unknown) {
          setSubmitError(error instanceof Error ? error.message : 'No se pudo registrar el movimiento.');
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      {submitError ? (
        <div className="md:col-span-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}
      <select
        value={tipo}
        onChange={(e) => {
          const value = e.target.value;
          if (isTipo(value)) setTipo(value);
        }}
        className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <option value="INGRESO">Ingreso</option>
        <option value="EGRESO">Egreso</option>
        <option value="TRANSFERENCIA">Transferencia</option>
      </select>
      <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" className="rounded-lg bg-white border border-slate-200 px-3 py-2 md:col-span-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200" />
      <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200" />
      <select value={origen} onChange={(e) => setOrigen(e.target.value)} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200">
        <option value="MANUAL">Manual</option>
        <option value="COMPRA_MP">Compra MP</option>
        <option value="PAGO_PROVEEDOR">Pago proveedor</option>
        <option value="VENTA">Venta</option>
        <option value="PRODUCCION">Producción</option>
        <option value="MERMA">Merma</option>
        <option value="IMPUESTO">Impuesto</option>
        <option value="SERVICIO">Servicio</option>
      </select>
      <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold md:col-span-5 transition-colors">
        {isSubmitting ? 'Registrando...' : 'Registrar movimiento'}
      </button>
    </form>
  );
};
