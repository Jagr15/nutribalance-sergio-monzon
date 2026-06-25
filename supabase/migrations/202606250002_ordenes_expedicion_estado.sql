alter table public.ordenes_expedicion
  add column if not exists estado text not null default 'pendiente';

do $$
begin
  update public.ordenes_expedicion
    set estado = lower(estado)
  where estado is not null;

  update public.ordenes_expedicion
    set estado = 'pendiente'
  where estado not in ('pendiente', 'preparando', 'lista', 'despachada', 'cancelada');

  if not exists (
    select 1 from pg_constraint where conname = 'ordenes_expedicion_estado_chk'
  ) then
    alter table public.ordenes_expedicion
      add constraint ordenes_expedicion_estado_chk
      check (estado in ('pendiente', 'preparando', 'lista', 'despachada', 'cancelada'));
  end if;
end;
$$;
