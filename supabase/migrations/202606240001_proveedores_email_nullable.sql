-- Allow supplier email to be optional.
-- CUIT/documento is already nullable in the base schema.

alter table if exists public.proveedores
  alter column email drop not null;

