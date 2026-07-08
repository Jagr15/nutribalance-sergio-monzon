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
  fuente_costo: 'PROMEDIO_STOCK' | 'REFERENCIA' | 'SIN_COSTO' | null;
  insumos: { legacy_uid: string | null; nombre: string } | null;
}

const hasIngredientProteinData = (ingredientes: Ingrediente[]) =>
  ingredientes.some((ing) => typeof ing.aporte_proteina_pct === 'number' && !Number.isNaN(ing.aporte_proteina_pct));

const getProteinFromIngredients = (ingredientes: Ingrediente[]) =>
  ingredientes.reduce((acc, ing) => acc + (Number(ing.aporte_proteina_pct) || 0), 0);

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
  proteina_calculada_pct: hasIngredientProteinData(ingredientes)
    ? getProteinFromIngredients(ingredientes)
    : row.proteina_calculada_pct ?? undefined,
  costo_total: row.costo_total ?? undefined,
  costo_por_kg: row.costo_por_kg ?? undefined,
  costo_por_tonelada: row.costo_por_tonelada ?? undefined,
  advertencias_nutricionales: row.advertencias_nutricionales ?? [],
  advertencias_costos: row.advertencias_costos ?? [],
});

const cleanNumber = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string') {
    const normalized = val.replace(',', '.').trim();
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof val === 'number') {
    return Number.isNaN(val) ? null : val;
  }
  return null;
};

const mapFuenteCostoParaDb = (fuente: string | null | undefined): string | null => {
  if (!fuente) return null;
  const upper = fuente.trim().toUpperCase();
  if (upper === 'PROMEDIO_STOCK') return 'ULTIMO_LOTE';
  if (upper === 'ULTIMO_LOTE' || upper === 'REFERENCIA' || upper === 'SIN_COSTO') {
    return upper;
  }
  return null;
};

const mapFuenteCostoDesdeDb = (fuente: string | null | undefined): 'PROMEDIO_STOCK' | 'REFERENCIA' | 'SIN_COSTO' | undefined => {
  if (!fuente) return undefined;
  const upper = fuente.trim().toUpperCase();
  if (upper === 'ULTIMO_LOTE') return 'PROMEDIO_STOCK';
  if (upper === 'PROMEDIO_STOCK' || upper === 'REFERENCIA' || upper === 'SIN_COSTO') {
    return upper as 'PROMEDIO_STOCK' | 'REFERENCIA' | 'SIN_COSTO';
  }
  return undefined;
};

const logSupabaseError = (context: string, error: any) => {
  if (error) {
    console.error(`Error Supabase ${context}:`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
  }
};

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
        fuente_costo: mapFuenteCostoDesdeDb(row.fuente_costo),
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

  if (error) {
    logSupabaseError("insumos select", error);
    throw error;
  }

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

  if (error) {
    logSupabaseError("usuarios select", error);
    throw error;
  }
  return data?.id ?? null;
};

const loadIngredientesByFormulaIds = async (formulaIds: string[]): Promise<Map<string, Ingrediente[]>> => {
  if (formulaIds.length === 0) return new Map<string, Ingrediente[]>();

  const { data, error } = await supabaseClient
    .from('formula_ingredientes')
    .select('formula_id,porcentaje,orden,nombre_insumo,aporte_proteina_pct,aporte_proteina_g_kg,costo_unitario_usado,costo_contribucion_kg,fuente_costo,insumos(legacy_uid,nombre)')
    .in('formula_id', formulaIds);

  if (error) {
    logSupabaseError("formula_ingredientes select", error);
    throw error;
  }
  return buildIngredientesMap((data ?? []) as unknown as FormulaIngredienteRow[]);
};

export const supabaseFormulaService = {
  async findAll(): Promise<Formula[]> {
    const { data, error } = await supabaseClient
      .from('formulas')
      .select('id,legacy_uid,nombre_producto,version,esta_activa,ultima_edicion,proteina_calculada_pct,costo_total,costo_por_kg,costo_por_tonelada,advertencias_nutricionales,advertencias_costos,author,created_at,usuarios(legacy_uid,nombre)')
      .is('deleted_at', null)
      .order('ultima_edicion', { ascending: false });

    if (error) {
      logSupabaseError("formulas findAll", error);
      throw error;
    }

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

    if (error) {
      logSupabaseError("formulas getById", error);
      throw error;
    }
    if (!data) return undefined;

    const row = data as unknown as FormulaRow;
    const ingredientesMap = await loadIngredientesByFormulaIds([row.id]);
    return toFormula(row, ingredientesMap.get(row.id) ?? []);
  },

  async create(payload: Omit<Formula, 'uid' | 'ultima_edicion'>): Promise<Formula> {
    const usuarioId = await findUsuarioId(payload.id_usuario);
    const proteinaCalculadaPct = hasIngredientProteinData(payload.ingredientes)
      ? getProteinFromIngredients(payload.ingredientes)
      : payload.proteina_calculada_pct ?? null;

    const formulaPayload = {
      legacy_uid: `for-${Math.random().toString(36).slice(2, 10)}`,
      nombre_producto: payload.nombre_producto,
      version: cleanNumber(payload.version) ?? 1,
      esta_activa: payload.esta_activa,
      ultima_edicion: new Date().toISOString(),
      proteina_calculada_pct: cleanNumber(proteinaCalculadaPct),
      costo_total: cleanNumber(payload.costo_total),
      costo_por_kg: cleanNumber(payload.costo_por_kg),
      costo_por_tonelada: cleanNumber(payload.costo_por_tonelada),
      advertencias_nutricionales: payload.advertencias_nutricionales ?? [],
      advertencias_costos: payload.advertencias_costos ?? [],
      id_usuario: usuarioId,
      author: payload.author,
      created_at: payload.createdAt.toISOString(),
    };

    console.log("Payload formula:", formulaPayload);

    const { data, error } = await supabaseClient
      .from('formulas')
      .insert(formulaPayload)
      .select('id,legacy_uid,nombre_producto,version,esta_activa,ultima_edicion,proteina_calculada_pct,costo_total,costo_por_kg,costo_por_tonelada,advertencias_nutricionales,advertencias_costos,author,created_at,usuarios(legacy_uid,nombre)')
      .single();

    if (error) {
      logSupabaseError("formulas insert", error);
      throw error;
    }

    const created = data as unknown as FormulaRow;
    const insumoIdMap = await getFormulaInsumoIdMap();

    if (payload.ingredientes.length > 0) {
      if (!created.id) {
        throw new Error("No se pudo obtener el ID de la fórmula insertada antes de guardar los ingredientes.");
      }

      const ingredientesPayload = payload.ingredientes.map((ing, index) => {
        const insumoDbId = insumoIdMap.get(ing.id_insumo);
        if (!insumoDbId) {
          throw new Error(`No se encontró un insumo_id válido en Supabase para el insumo de la fórmula: '${ing.id_insumo}' - '${ing.nombre_insumo}'`);
        }

        const pctVal = cleanNumber(ing.porcentaje);
        if (pctVal === null) {
          throw new Error(`Porcentaje inválido para el insumo ${ing.nombre_insumo || ing.id_insumo}`);
        }

        return {
          formula_id: created.id,
          insumo_id: insumoDbId,
          nombre_insumo: ing.nombre_insumo,
          porcentaje: pctVal,
          orden: cleanNumber(index + 1) ?? 1,
          aporte_proteina_pct: cleanNumber(ing.aporte_proteina_pct),
          aporte_proteina_g_kg: cleanNumber(ing.aporte_proteina_g_kg),
          costo_unitario_usado: cleanNumber(ing.costo_unitario_usado ?? (ing as any).costo_unitario_usd),
          costo_contribucion_kg: cleanNumber(ing.costo_contribucion_kg),
          fuente_costo: mapFuenteCostoParaDb(ing.fuente_costo),
        };
      });

      console.log("Payload ingredientes:", ingredientesPayload);

      const { error: ingredientesError } = await supabaseClient
        .from('formula_ingredientes')
        .insert(ingredientesPayload);

      if (ingredientesError) {
        console.log("Error Supabase ingredientes:", ingredientesError);
        logSupabaseError("ingredientes insert", ingredientesError);
        throw ingredientesError;
      }
    }

    return toFormula(created, payload.ingredientes);
  },

  async update(uid: string, payload: Partial<Formula>): Promise<Formula> {
    const { data: current, error: currentError } = await supabaseClient
      .from('formulas')
      .select('id')
      .eq('legacy_uid', uid)
      .single<{ id: string }>();

    if (currentError) {
      logSupabaseError("formulas select", currentError);
      throw currentError;
    }

    let usuarioId: string | null | undefined;
    if (payload.id_usuario) {
      usuarioId = await findUsuarioId(payload.id_usuario);
    }

    const proteinaCalculadaPct = payload.ingredientes && hasIngredientProteinData(payload.ingredientes)
      ? getProteinFromIngredients(payload.ingredientes)
      : payload.proteina_calculada_pct;

    const rawPayload = {
      nombre_producto: payload.nombre_producto,
      version: cleanNumber(payload.version),
      esta_activa: payload.esta_activa,
      ultima_edicion: new Date().toISOString(),
      proteina_calculada_pct: cleanNumber(proteinaCalculadaPct),
      costo_total: cleanNumber(payload.costo_total),
      costo_por_kg: cleanNumber(payload.costo_por_kg),
      costo_por_tonelada: cleanNumber(payload.costo_por_tonelada),
      advertencias_nutricionales: payload.advertencias_nutricionales,
      advertencias_costos: payload.advertencias_costos,
      id_usuario: usuarioId,
      author: payload.author,
    };
    const cleanPayload = Object.fromEntries(
      Object.entries(rawPayload).filter(([, value]) => value !== undefined)
    );

    console.log("Payload formula:", cleanPayload);

    const { data, error } = await supabaseClient
      .from('formulas')
      .update(cleanPayload)
      .eq('legacy_uid', uid)
      .select('id,legacy_uid,nombre_producto,version,esta_activa,ultima_edicion,proteina_calculada_pct,costo_total,costo_por_kg,costo_por_tonelada,advertencias_nutricionales,advertencias_costos,author,created_at,usuarios(legacy_uid,nombre)')
      .single();

    if (error) {
      logSupabaseError("formulas update", error);
      throw error;
    }

    const updated = data as unknown as FormulaRow;

    if (payload.ingredientes) {
      if (!current.id) {
        throw new Error("No se pudo obtener el ID de la fórmula actual antes de guardar los ingredientes.");
      }

      const insumoIdMap = await getFormulaInsumoIdMap();

      const { error: deleteError } = await supabaseClient
        .from('formula_ingredientes')
        .delete()
        .eq('formula_id', current.id);

      if (deleteError) {
        logSupabaseError("ingredientes delete", deleteError);
        throw deleteError;
      }

      const insertRows = payload.ingredientes.map((ing, index) => {
        const insumoDbId = insumoIdMap.get(ing.id_insumo);
        if (!insumoDbId) {
          throw new Error(`No se encontró un insumo_id válido en Supabase para el insumo de la fórmula: '${ing.id_insumo}' - '${ing.nombre_insumo}'`);
        }

        const pctVal = cleanNumber(ing.porcentaje);
        if (pctVal === null) {
          throw new Error(`Porcentaje inválido para el insumo ${ing.nombre_insumo || ing.id_insumo}`);
        }

        return {
          formula_id: current.id,
          insumo_id: insumoDbId,
          nombre_insumo: ing.nombre_insumo,
          porcentaje: pctVal,
          orden: cleanNumber(index + 1) ?? 1,
          aporte_proteina_pct: cleanNumber(ing.aporte_proteina_pct),
          aporte_proteina_g_kg: cleanNumber(ing.aporte_proteina_g_kg),
          costo_unitario_usado: cleanNumber(ing.costo_unitario_usado ?? (ing as any).costo_unitario_usd),
          costo_contribucion_kg: cleanNumber(ing.costo_contribucion_kg),
          fuente_costo: mapFuenteCostoParaDb(ing.fuente_costo),
        };
      });

      console.log("Payload ingredientes:", insertRows);

      if (insertRows.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('formula_ingredientes')
          .insert(insertRows);

        if (insertError) {
          console.log("Error Supabase ingredientes:", insertError);
          logSupabaseError("ingredientes insert", insertError);
          throw insertError;
        }
      }
    }

    const ingredientes = payload.ingredientes ?? (await loadIngredientesByFormulaIds([updated.id])).get(updated.id) ?? [];
    return toFormula(updated, ingredientes);
  },

  async delete(uid: string): Promise<boolean> {
    const { data: formula, error: formErr } = await supabaseClient
      .from('formulas')
      .select('id')
      .eq('legacy_uid', uid)
      .maybeSingle<{ id: string }>();

    if (formErr) throw formErr;
    if (!formula) throw new Error('Fórmula no encontrada');

    // Check if formula is used in any production orders
    const { count: orderCount, error: orderErr } = await supabaseClient
      .from('ordenes_produccion')
      .select('id', { count: 'exact', head: true })
      .eq('formula_id', formula.id);
    if (orderErr) throw orderErr;

    if ((orderCount ?? 0) > 0) {
      throw new Error('No se puede eliminar la fórmula porque está asociada a órdenes de producción existentes.');
    }

    const { error } = await supabaseClient
      .from('formulas')
      .update({
        esta_activa: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', formula.id);

    if (error) throw error;
    return true;
  },
};
