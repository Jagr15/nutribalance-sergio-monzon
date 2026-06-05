import type { Formula, Ingrediente } from '../../../../features/formulas/types';
import { supabaseClient } from '../client';

interface FormulaRow {
  id: string;
  legacy_uid: string | null;
  nombre_producto: string;
  version: number;
  esta_activa: boolean;
  ultima_edicion: string;
  proteina_calculada_pct: number | null;
  costo_total: number | null;
  costo_por_kg: number | null;
  costo_por_tonelada: number | null;
  advertencias_nutricionales: string[] | null;
  advertencias_costos: string[] | null;
  author: string;
  created_at: string;
  usuarios: { legacy_uid: string | null; nombre: string } | null;
}

interface FormulaIngredienteRow {
  formula_id: string;
  porcentaje: number;
  orden: number;
  nombre_insumo: string;
  aporte_proteina_pct: number | null;
  aporte_proteina_g_kg: number | null;
  costo_unitario_usado: number | null;
  costo_contribucion_kg: number | null;
  fuente_costo: 'ULTIMO_LOTE' | 'REFERENCIA' | 'SIN_COSTO' | null;
  insumos: { legacy_uid: string | null; nombre: string } | null;
}

const toFormula = (row: FormulaRow, ingredientes: Ingrediente[]): Formula => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  nombre_producto: row.nombre_producto,
  ingredientes,
  version: Number(row.version),
  esta_activa: row.esta_activa,
  ultima_edicion: new Date(row.ultima_edicion),
  id_usuario: row.usuarios?.legacy_uid ?? 'usr-admin-01',
  author: row.author || row.usuarios?.nombre || 'Sin autor',
  createdAt: new Date(row.created_at),
  proteina_calculada_pct: row.proteina_calculada_pct ?? undefined,
  costo_total: row.costo_total ?? undefined,
  costo_por_kg: row.costo_por_kg ?? undefined,
  costo_por_tonelada: row.costo_por_tonelada ?? undefined,
  advertencias_nutricionales: row.advertencias_nutricionales ?? [],
  advertencias_costos: row.advertencias_costos ?? [],
});

const buildIngredientesMap = (rows: FormulaIngredienteRow[]) => {
  const map = new Map<string, Ingrediente[]>();
  rows
    .sort((a, b) => a.orden - b.orden)
    .forEach((row) => {
      const ingrediente: Ingrediente = {
        id_insumo: row.insumos?.legacy_uid ?? '',
        nombre_insumo: row.nombre_insumo,
        porcentaje: Number(row.porcentaje),
        aporte_proteina_pct: row.aporte_proteina_pct ?? undefined,
        aporte_proteina_g_kg: row.aporte_proteina_g_kg ?? undefined,
        costo_unitario_usado: row.costo_unitario_usado ?? undefined,
        costo_contribucion_kg: row.costo_contribucion_kg ?? undefined,
        fuente_costo: row.fuente_costo ?? undefined,
      };

      const current = map.get(row.formula_id) ?? [];
      current.push(ingrediente);
      map.set(row.formula_id, current);
    });

  return map;
};

const getFormulaInsumoIdMap = async (): Promise<Map<string, string>> => {
  const { data, error } = await supabaseClient
    .from('insumos')
    .select('id,legacy_uid')
    .is('deleted_at', null);

  if (error) throw error;

  const map = new Map<string, string>();
  (data ?? []).forEach((row) => {
    if (row.legacy_uid) map.set(row.legacy_uid, row.id);
  });
  return map;
};

const findUsuarioId = async (legacyUid: string): Promise<string | null> => {
  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('id')
    .eq('legacy_uid', legacyUid)
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return data?.id ?? null;
};

const loadIngredientesByFormulaIds = async (formulaIds: string[]): Promise<Map<string, Ingrediente[]>> => {
  if (formulaIds.length === 0) return new Map<string, Ingrediente[]>();

  const { data, error } = await supabaseClient
    .from('formula_ingredientes')
    .select('formula_id,porcentaje,orden,nombre_insumo,aporte_proteina_pct,aporte_proteina_g_kg,costo_unitario_usado,costo_contribucion_kg,fuente_costo,insumos(legacy_uid,nombre)')
    .in('formula_id', formulaIds);

  if (error) throw error;
  return buildIngredientesMap((data ?? []) as unknown as FormulaIngredienteRow[]);
};

export const supabaseFormulaService = {
  async findAll(): Promise<Formula[]> {
    const { data, error } = await supabaseClient
      .from('formulas')
      .select('id,legacy_uid,nombre_producto,version,esta_activa,ultima_edicion,proteina_calculada_pct,costo_total,costo_por_kg,costo_por_tonelada,advertencias_nutricionales,advertencias_costos,author,created_at,usuarios(legacy_uid,nombre)')
      .is('deleted_at', null)
      .order('ultima_edicion', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as unknown as FormulaRow[];
    const ingredientesMap = await loadIngredientesByFormulaIds(rows.map((row) => row.id));

    return rows.map((row) => toFormula(row, ingredientesMap.get(row.id) ?? []));
  },

  async getById(uid: string): Promise<Formula | undefined> {
    const { data, error } = await supabaseClient
      .from('formulas')
      .select('id,legacy_uid,nombre_producto,version,esta_activa,ultima_edicion,proteina_calculada_pct,costo_total,costo_por_kg,costo_por_tonelada,advertencias_nutricionales,advertencias_costos,author,created_at,usuarios(legacy_uid,nombre)')
      .eq('legacy_uid', uid)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return undefined;

    const row = data as unknown as FormulaRow;
    const ingredientesMap = await loadIngredientesByFormulaIds([row.id]);
    return toFormula(row, ingredientesMap.get(row.id) ?? []);
  },

  async create(payload: Omit<Formula, 'uid' | 'ultima_edicion'>): Promise<Formula> {
    const usuarioId = await findUsuarioId(payload.id_usuario);

    const { data, error } = await supabaseClient
      .from('formulas')
      .insert({
        legacy_uid: `for-${Math.random().toString(36).slice(2, 10)}`,
        nombre_producto: payload.nombre_producto,
        version: payload.version,
        esta_activa: payload.esta_activa,
        ultima_edicion: new Date().toISOString(),
        proteina_calculada_pct: payload.proteina_calculada_pct ?? null,
        costo_total: payload.costo_total ?? null,
        costo_por_kg: payload.costo_por_kg ?? null,
        costo_por_tonelada: payload.costo_por_tonelada ?? null,
        advertencias_nutricionales: payload.advertencias_nutricionales ?? [],
        advertencias_costos: payload.advertencias_costos ?? [],
        id_usuario: usuarioId,
        author: payload.author,
        created_at: payload.createdAt.toISOString(),
      })
      .select('id,legacy_uid,nombre_producto,version,esta_activa,ultima_edicion,proteina_calculada_pct,costo_total,costo_por_kg,costo_por_tonelada,advertencias_nutricionales,advertencias_costos,author,created_at,usuarios(legacy_uid,nombre)')
      .single();

    if (error) throw error;

    const created = data as unknown as FormulaRow;
    const insumoIdMap = await getFormulaInsumoIdMap();

    if (payload.ingredientes.length > 0) {
      const ingredientesRows = payload.ingredientes.map((ing, index) => {
        const insumoDbId = insumoIdMap.get(ing.id_insumo);
        if (!insumoDbId) {
          throw new Error(`No se encontró insumo '${ing.id_insumo}' para fórmula.`);
        }

        return {
          formula_id: created.id,
          insumo_id: insumoDbId,
          nombre_insumo: ing.nombre_insumo,
          porcentaje: ing.porcentaje,
          orden: index + 1,
          aporte_proteina_pct: ing.aporte_proteina_pct ?? null,
          aporte_proteina_g_kg: ing.aporte_proteina_g_kg ?? null,
          costo_unitario_usado: ing.costo_unitario_usado ?? null,
          costo_contribucion_kg: ing.costo_contribucion_kg ?? null,
          fuente_costo: ing.fuente_costo ?? null,
        };
      });

      const { error: ingredientesError } = await supabaseClient
        .from('formula_ingredientes')
        .insert(ingredientesRows);

      if (ingredientesError) throw ingredientesError;
    }

    return toFormula(created, payload.ingredientes);
  },

  async update(uid: string, payload: Partial<Formula>): Promise<Formula> {
    const { data: current, error: currentError } = await supabaseClient
      .from('formulas')
      .select('id')
      .eq('legacy_uid', uid)
      .single<{ id: string }>();

    if (currentError) throw currentError;

    let usuarioId: string | null | undefined;
    if (payload.id_usuario) {
      usuarioId = await findUsuarioId(payload.id_usuario);
    }

    const rawPayload = {
      nombre_producto: payload.nombre_producto,
      version: payload.version,
      esta_activa: payload.esta_activa,
      ultima_edicion: new Date().toISOString(),
      proteina_calculada_pct: payload.proteina_calculada_pct,
      costo_total: payload.costo_total,
      costo_por_kg: payload.costo_por_kg,
      costo_por_tonelada: payload.costo_por_tonelada,
      advertencias_nutricionales: payload.advertencias_nutricionales,
      advertencias_costos: payload.advertencias_costos,
      id_usuario: usuarioId,
      author: payload.author,
    };
    const cleanPayload = Object.fromEntries(
      Object.entries(rawPayload).filter(([, value]) => value !== undefined)
    );

    const { data, error } = await supabaseClient
      .from('formulas')
      .update(cleanPayload)
      .eq('legacy_uid', uid)
      .select('id,legacy_uid,nombre_producto,version,esta_activa,ultima_edicion,proteina_calculada_pct,costo_total,costo_por_kg,costo_por_tonelada,advertencias_nutricionales,advertencias_costos,author,created_at,usuarios(legacy_uid,nombre)')
      .single();

    if (error) throw error;

    if (payload.ingredientes) {
      const insumoIdMap = await getFormulaInsumoIdMap();

      const { error: deleteError } = await supabaseClient
        .from('formula_ingredientes')
        .delete()
        .eq('formula_id', current.id);

      if (deleteError) throw deleteError;

      const insertRows = payload.ingredientes.map((ing, index) => {
        const insumoDbId = insumoIdMap.get(ing.id_insumo);
        if (!insumoDbId) {
          throw new Error(`No se encontró insumo '${ing.id_insumo}' para fórmula.`);
        }

        return {
          formula_id: current.id,
          insumo_id: insumoDbId,
          nombre_insumo: ing.nombre_insumo,
          porcentaje: ing.porcentaje,
          orden: index + 1,
          aporte_proteina_pct: ing.aporte_proteina_pct ?? null,
          aporte_proteina_g_kg: ing.aporte_proteina_g_kg ?? null,
          costo_unitario_usado: ing.costo_unitario_usado ?? null,
          costo_contribucion_kg: ing.costo_contribucion_kg ?? null,
          fuente_costo: ing.fuente_costo ?? null,
        };
      });

      if (insertRows.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('formula_ingredientes')
          .insert(insertRows);

        if (insertError) throw insertError;
      }
    }

    const updated = data as unknown as FormulaRow;
    const ingredientes = payload.ingredientes ?? (await loadIngredientesByFormulaIds([updated.id])).get(updated.id) ?? [];
    return toFormula(updated, ingredientes);
  },

  async delete(uid: string): Promise<boolean> {
    const { error } = await supabaseClient
      .from('formulas')
      .update({
        esta_activa: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('legacy_uid', uid);

    if (error) throw error;
    return true;
  },
};
