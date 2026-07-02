-- Remove max limit check constraint from proteina_bruta_pct on insumos table.
-- The client confirmed they can have crude protein (proteína bruta) values greater than 100% (e.g. 200% or 281%).
-- Drops both potential check constraints (insumos_proteina_bruta_pct_range and insumos_proteina_bruta_pct_chk) and adds a single correct check constraint.

ALTER TABLE public.insumos
  DROP CONSTRAINT IF EXISTS insumos_proteina_bruta_pct_range;

ALTER TABLE public.insumos
  DROP CONSTRAINT IF EXISTS insumos_proteina_bruta_pct_chk;

ALTER TABLE public.insumos
  ADD CONSTRAINT insumos_proteina_bruta_pct_chk
  CHECK (
    proteina_bruta_pct IS NULL
    OR proteina_bruta_pct >= 0
  );
