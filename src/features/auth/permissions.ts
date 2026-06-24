export const USER_ROLES = ['superadmin', 'encargado', 'operario', 'admin', 'produccion', 'inventario', 'finanzas', 'supervisor', 'solo_lectura'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type AppModule =
  | 'dashboard'
  | 'usuarios'
  | 'clientes'
  | 'stock_general'
  | 'alertas'
  | 'proveedores'
  | 'silos'
  | 'insumos'
  | 'formulas'
  | 'ordenes'
  | 'finanzas'
  | 'tesoreria'
  | 'trazabilidad'
  | 'stock_mp'
  | 'productos';

export type AppAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'start_order'
  | 'finish_order'
  | 'register_financial_movement'
  | 'modify_stock'
  // Compatibilidad con llamadas existentes del sistema
  | 'create_formula'
  | 'edit_formula'
  | 'cancel_order';

const allModules: AppModule[] = [
  'dashboard', 'usuarios', 'clientes', 'stock_general', 'alertas', 'proveedores', 'silos', 'insumos',
  'formulas', 'ordenes', 'finanzas', 'tesoreria', 'trazabilidad', 'stock_mp', 'productos',
];

const emptyByModule = allModules.reduce<Record<AppModule, AppAction[]>>((acc, mod) => {
  acc[mod] = [];
  return acc;
}, {} as Record<AppModule, AppAction[]>);

const uniq = (actions: AppAction[]) => [...new Set(actions)];

export const ROLE_PERMISSIONS: Record<UserRole, Record<AppModule, AppAction[]>> = {
  superadmin: allModules.reduce<Record<AppModule, AppAction[]>>((acc, mod) => {
    acc[mod] = uniq([
      'view', 'create', 'edit', 'delete', 'approve',
      'start_order', 'finish_order', 'register_financial_movement', 'modify_stock',
      'create_formula', 'edit_formula', 'cancel_order',
    ]);
    return acc;
  }, {} as Record<AppModule, AppAction[]>),

  admin: allModules.reduce<Record<AppModule, AppAction[]>>((acc, mod) => {
    acc[mod] = uniq([
      'view', 'create', 'edit', 'delete', 'approve',
      'start_order', 'finish_order', 'register_financial_movement', 'modify_stock',
      'create_formula', 'edit_formula', 'cancel_order',
    ]);
    return acc;
  }, {} as Record<AppModule, AppAction[]>),

  encargado: {
    ...emptyByModule,
    dashboard: ['view'],
    usuarios: ['view', 'create', 'edit'],
    clientes: ['view', 'create', 'edit'],
    proveedores: ['view', 'create', 'edit'],
    insumos: ['view', 'create', 'edit', 'modify_stock'],
    stock_mp: ['view', 'create', 'edit', 'modify_stock'],
    stock_general: ['view', 'edit', 'modify_stock'],
    silos: ['view', 'create', 'edit'],
    formulas: ['view', 'create', 'edit', 'approve', 'create_formula', 'edit_formula'],
    ordenes: ['view', 'create', 'edit', 'start_order', 'finish_order', 'cancel_order'],
    productos: ['view', 'edit'],
    finanzas: ['view', 'register_financial_movement'],
    tesoreria: ['view'],
    trazabilidad: ['view'],
    alertas: ['view'],
  },

  operario: {
    ...emptyByModule,
    dashboard: ['view'],
    alertas: ['view'],
    trazabilidad: ['view'],
    formulas: ['view'],
    productos: ['view'],
    stock_general: ['view'],
    ordenes: ['view', 'start_order', 'finish_order'],
    tesoreria: ['view'],
  },

  supervisor: {
    ...emptyByModule,
    dashboard: ['view'],
    clientes: ['view', 'create', 'edit'],
    proveedores: ['view', 'create', 'edit'],
    insumos: ['view', 'modify_stock', 'edit'],
    stock_mp: ['view', 'modify_stock', 'edit'],
    stock_general: ['view', 'modify_stock', 'edit'],
    silos: ['view', 'create', 'edit'],
    formulas: ['view', 'create', 'edit', 'approve', 'create_formula', 'edit_formula'],
    ordenes: ['view', 'create', 'edit', 'approve', 'start_order', 'finish_order', 'cancel_order'],
    productos: ['view', 'edit'],
    finanzas: ['view', 'register_financial_movement', 'approve'],
    tesoreria: ['view', 'approve'],
    alertas: ['view', 'approve'],
    trazabilidad: ['view'],
    usuarios: ['view'],
  },

  produccion: {
    ...emptyByModule,
    dashboard: ['view'],
    alertas: ['view'],
    trazabilidad: ['view'],
    formulas: ['view'],
    productos: ['view'],
    stock_general: ['view'],
    ordenes: ['view', 'start_order', 'finish_order', 'cancel_order'],
    tesoreria: ['view'],
    usuarios: [],
    finanzas: [],
  },

  inventario: {
    ...emptyByModule,
    dashboard: ['view'],
    alertas: ['view'],
    trazabilidad: ['view'],
    productos: ['view'],
    stock_mp: ['view', 'modify_stock', 'edit'],
    stock_general: ['view', 'modify_stock', 'edit'],
    insumos: ['view', 'modify_stock', 'edit'],
    proveedores: ['view', 'modify_stock', 'edit'],
    silos: ['view', 'modify_stock', 'edit'],
    ordenes: ['view'],
    tesoreria: ['view'],
    usuarios: [],
    finanzas: [],
  },

  finanzas: {
    ...emptyByModule,
    dashboard: ['view'],
    formulas: ['view'],
    productos: ['view'],
    ordenes: ['view'],
    finanzas: ['view', 'register_financial_movement', 'approve'],
    tesoreria: ['view'],
    stock_general: ['view'],
    usuarios: [],
  },

  solo_lectura: {
    ...emptyByModule,
    dashboard: ['view'],
    stock_general: ['view'],
    formulas: ['view'],
    ordenes: ['view'],
    productos: ['view'],
    trazabilidad: ['view'],
    alertas: ['view'],
    finanzas: ['view'],
    tesoreria: ['view'],
    usuarios: [],
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  encargado: 'Encargado',
  operario: 'Operario',
  admin: 'Admin',
  produccion: 'Producción',
  inventario: 'Inventario',
  finanzas: 'Finanzas',
  supervisor: 'Supervisor',
  solo_lectura: 'Solo Lectura',
};

export const normalizeRole = (raw?: string | null): UserRole => {
  const value = (raw ?? '').toLowerCase().trim();
  if (value === 'admin') return 'encargado';
  if (USER_ROLES.includes(value as UserRole)) return value as UserRole;
  if (value.includes('superadmin')) return 'superadmin';
  if (value.includes('encarg')) return 'encargado';
  if (value.includes('oper')) return 'operario';
  if (value.includes('super') && !value.includes('superadmin')) return 'supervisor';
  if (value.includes('produ')) return 'produccion';
  if (value.includes('invent')) return 'inventario';
  if (value.includes('finan')) return 'finanzas';
  return 'solo_lectura';
};

export const can = (role: UserRole, module: AppModule, action: AppAction) => {
  const actions = ROLE_PERMISSIONS[role][module] ?? [];
  if (action === 'create_formula') return actions.includes('create_formula') || actions.includes('create');
  if (action === 'edit_formula') return actions.includes('edit_formula') || actions.includes('edit');
  if (action === 'cancel_order') return actions.includes('cancel_order') || actions.includes('delete');
  return actions.includes(action);
};
