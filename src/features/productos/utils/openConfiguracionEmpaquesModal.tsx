import Swal from 'sweetalert2';
import { ApiService } from '../../../infrastructure/api';
import type { ConfiguracionEmpaque } from '../types/configuracionEmpaque';
import { isDefaultConfiguracionEmpaque, mergeConfiguracionEmpaques } from '../constants/configuracionEmpaquesDefaults';

const formatLabel = (item: Pick<ConfiguracionEmpaque, 'tipo_empaque' | 'capacidad_kg'>) =>
  `${item.tipo_empaque === 'BOLSA' ? 'Bolsa' : 'Big Bag'} · ${Number(item.capacidad_kg)} kg`;

export const openConfiguracionEmpaquesModal = async (onRefresh?: () => Promise<void> | void) => {
  const render = async () => {
    let rows: ConfiguracionEmpaque[] = [];
    let loadError: unknown = null;
    try {
      rows = await ApiService.configuracionEmpaques.getAll();
    } catch (error) {
      console.error("[empaques] no se pudo cargar la configuracion global", error);
      loadError = error;
    }
    const mergedRows = mergeConfiguracionEmpaques(rows);
    const htmlList = mergedRows.length > 0
      ? mergedRows.map((item) => `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:8px; background:${item.esta_activo ? '#f8fafc' : '#fff7ed'};">
            <div>
              <div style="font-weight:700; color:#0f172a;">${formatLabel(item)}</div>
              <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:${item.esta_activo ? '#64748b' : '#c2410c'};">
                <span>${item.esta_activo ? 'Activo' : 'Inactivo'}</span>
                ${isDefaultConfiguracionEmpaque(item) ? '<span style="padding:2px 8px; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-weight:700;">Base</span>' : ''}
              </div>
            </div>
            ${isDefaultConfiguracionEmpaque(item)
              ? '<span style="border:1px solid #cbd5e1; background:#f8fafc; color:#64748b; border-radius:10px; padding:8px 12px; font-size:12px; font-weight:700;">Base</span>'
              : `<button type="button" class="toggle-empaque-btn" data-id="${item.id}" data-active="${item.esta_activo ? '1' : '0'}" style="border:1px solid #cbd5e1; background:#fff; color:#0f172a; border-radius:10px; padding:8px 12px; font-size:12px; font-weight:700;">${item.esta_activo ? 'Desactivar' : 'Activar'}</button>`}
          </div>
        `).join('')
      : '<div style="padding:12px; border:1px dashed #f59e0b; border-radius:12px; background:#fffbeb; color:#b45309;">No hay empaques configurados.</div>';

    await Swal.fire({
      title: 'Configurar empaques',
      html: `
        <div style="text-align:left; color:#0f172a; font-size:14px;">
          ${loadError ? `<div style="margin-bottom:12px;padding:12px 14px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#b91c1c;font-size:12px;">Error cargando configuración: ${String((loadError as { message?: unknown } | null)?.message ?? loadError)}</div>` : ''}
          <div style="margin-bottom:12px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <button type="button" id="add-bolsa" style="border:none; border-radius:12px; padding:10px 12px; font-weight:700; background:#dbeafe; color:#1d4ed8;">Agregar Bolsa</button>
            <button type="button" id="add-bigbag" style="border:none; border-radius:12px; padding:10px 12px; font-weight:700; background:#e0f2fe; color:#0369a1;">Agregar Big Bag</button>
          </div>
          <div id="empaques-list">${htmlList}</div>
        </div>
      `,
      background: '#ffffff',
      color: '#0f172a',
      showCancelButton: true,
      confirmButtonText: 'Cerrar',
      cancelButtonText: 'Salir',
      confirmButtonColor: '#2563eb',
      width: 720,
      didOpen: () => {
        const add = async (tipo: 'BOLSA' | 'BIG_BAG') => {
          const capacidades = tipo === 'BOLSA' ? [15, 20, 25, 40] : [500, 1000];
          const { value: capacidad } = await Swal.fire({
            title: `Agregar ${tipo === 'BOLSA' ? 'Bolsa' : 'Big Bag'}`,
            input: 'select',
            inputOptions: capacidades.reduce<Record<string, string>>((acc, cap) => {
              acc[String(cap)] = `${cap} kg`;
              return acc;
            }, {}),
            inputPlaceholder: 'Seleccionar capacidad',
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            background: '#ffffff',
            color: '#0f172a',
            confirmButtonColor: '#2563eb',
          });

          if (!capacidad) return;
          await ApiService.configuracionEmpaques.create({
            tipo_empaque: tipo,
            capacidad_kg: Number(capacidad) as 15 | 20 | 25 | 40 | 500 | 1000,
          });
          await onRefresh?.();
          await render();
        };

        document.getElementById('add-bolsa')?.addEventListener('click', () => { void add('BOLSA'); });
        document.getElementById('add-bigbag')?.addEventListener('click', () => { void add('BIG_BAG'); });
        document.querySelectorAll<HTMLButtonElement>('.toggle-empaque-btn').forEach((button) => {
          button.addEventListener('click', async () => {
            const id = button.dataset.id ?? '';
            const activo = button.dataset.active === '1';
            await ApiService.configuracionEmpaques.toggleActive(id, !activo);
            await onRefresh?.();
            await render();
          });
        });
      },
    });
  };

  await render();
};
