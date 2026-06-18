import { describe, expect, it } from 'vitest';
import { can, normalizeRole } from './permissions';

describe('permissions', () => {
  it('normaliza roles', () => {
    expect(normalizeRole('ADMIN')).toBe('admin');
    expect(normalizeRole('SUPERADMIN')).toBe('superadmin');
    expect(normalizeRole('finanzas')).toBe('finanzas');
    expect(normalizeRole('desconocido')).toBe('solo_lectura');
  });

  it('aplica matriz de permisos', () => {
    expect(can('admin', 'finanzas', 'register_financial_movement')).toBe(true);
    expect(can('solo_lectura', 'finanzas', 'register_financial_movement')).toBe(false);
    expect(can('produccion', 'ordenes', 'finish_order')).toBe(true);
    expect(can('produccion', 'ordenes', 'create')).toBe(false);
    expect(can('produccion', 'silos', 'view')).toBe(false);
    expect(can('produccion', 'usuarios', 'view')).toBe(false);
    expect(can('produccion', 'finanzas', 'view')).toBe(false);
    expect(can('inventario', 'ordenes', 'finish_order')).toBe(false);
    expect(can('inventario', 'ordenes', 'start_order')).toBe(false);
    expect(can('inventario', 'formulas', 'view')).toBe(false);
    expect(can('finanzas', 'stock_mp', 'modify_stock')).toBe(false);
    expect(can('finanzas', 'proveedores', 'view')).toBe(false);
    expect(can('finanzas', 'trazabilidad', 'view')).toBe(false);
    expect(can('superadmin', 'usuarios', 'view')).toBe(true);
    expect(can('superadmin', 'usuarios', 'create')).toBe(true);
    expect(can('supervisor', 'usuarios', 'view')).toBe(false);
    expect(can('supervisor', 'ordenes', 'start_order')).toBe(true);
    expect(can('solo_lectura', 'clientes', 'view')).toBe(false);
  });
});
