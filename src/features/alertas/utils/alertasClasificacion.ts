import type { AlertaOperativa } from '../types/alerta';

export type AlertCategoryTone = 'red' | 'amber';
export type AlertCategoryKey = 'financiera' | 'produccion' | 'general';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const isProductAlert = (alerta: AlertaOperativa) => {
  const hayEnTituloODesc = [alerta.titulo, alerta.descripcion, alerta.area, alerta.datoAsociado?.producto, alerta.datoAsociado?.insumo, alerta.datoAsociado?.lote, alerta.datoAsociado?.orden]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => /stock|producci[oó]n|lote|inventario|insumo|producto terminado|trazabilidad|merma|despacho|orden/i.test(value));
  return alerta.area === 'stock' || alerta.area === 'produccion' || alerta.area === 'productos' || hayEnTituloODesc;
};

export const isFinancialAlert = (alerta: AlertaOperativa) => {
  const hayEnTituloODesc = [alerta.titulo, alerta.descripcion, alerta.area]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => /flujo de caja|tesorer[ií]a|cuentas por cobrar|cuentas por pagar|descubierto|costos|ingresos|finanzas|margen|caja/i.test(value));
  return alerta.area === 'costos' || alerta.area === 'tesoreria' || hayEnTituloODesc;
};

export const getAlertCategory = (alerta: AlertaOperativa): AlertCategoryKey => {
  if (isFinancialAlert(alerta)) return 'financiera';
  if (isProductAlert(alerta)) return 'produccion';
  return 'general';
};

export const buildAlertExample = (alerta: AlertaOperativa) => {
  const parts = [alerta.titulo, alerta.area.toUpperCase(), alerta.fechaRelativa];
  const dato = [
    alerta.datoAsociado?.producto,
    alerta.datoAsociado?.insumo,
    alerta.datoAsociado?.lote ? `Lote ${alerta.datoAsociado.lote}` : null,
    alerta.datoAsociado?.orden ? `OP ${alerta.datoAsociado.orden}` : null,
  ].filter((item): item is string => Boolean(item));
  const extra = dato.length > 0 ? ` · ${dato.join(' · ')}` : '';
  return `${parts.join(' · ')}${extra}`;
};

export const buildAlertCategoryHtml = (
  title: string,
  description: string,
  alerts: AlertaOperativa[],
  tone: AlertCategoryTone,
) => {
  const count = alerts.length;
  const examples = alerts.slice(0, 3);
  const emptyState = count === 0
    ? '<div style="margin-top:12px;padding:14px;border:1px dashed #cbd5e1;border-radius:16px;background:#f8fafc;color:#64748b;font-size:13px;">Sin alertas críticas</div>'
    : '';

  return `
    <div style="flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:20px;background:#ffffff;box-shadow:0 14px 40px rgba(15,23,42,.06);overflow:hidden;">
      <div style="height:6px;background:linear-gradient(90deg, ${tone === 'red' ? '#ef4444' : '#f59e0b'}, ${tone === 'red' ? '#fb7185' : '#f97316'});"></div>
      <div style="padding:18px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div>
            <p style="margin:0 0 6px;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">${escapeHtml(title)}</p>
            <p style="margin:0;color:#334155;font-size:13px;line-height:1.5;">${escapeHtml(description)}</p>
          </div>
          <div style="min-width:74px;padding:10px 12px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;text-align:right;">
            <p style="margin:0;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.16em;">Críticas</p>
            <p style="margin:4px 0 0;color:${tone === 'red' ? '#b91c1c' : '#c2410c'};font-size:28px;font-weight:900;line-height:1;">${count}</p>
          </div>
        </div>
        ${emptyState}
        ${count > 0 ? `
          <div style="margin-top:14px;display:grid;gap:10px;">
            ${examples.map((alerta) => `
              <div style="padding:12px 12px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
                  <div style="min-width:0;">
                    <p style="margin:0 0 4px;color:#0f172a;font-size:13px;font-weight:800;">${escapeHtml(alerta.titulo)}</p>
                    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">${escapeHtml(buildAlertExample(alerta))}</p>
                  </div>
                  <span style="flex-shrink:0;padding:4px 8px;border-radius:999px;background:${alerta.prioridad === 'critica' ? '#fee2e2' : '#fef3c7'};color:${alerta.prioridad === 'critica' ? '#b91c1c' : '#b45309'};font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;">${escapeHtml(alerta.prioridad)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
};
