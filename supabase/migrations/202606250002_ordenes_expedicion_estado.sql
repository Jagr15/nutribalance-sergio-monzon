alter table public.ordenes_expedicion
  add column if not exists estado text not null default 'pendiente';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'ordenes_expedicion_estado_chk'
  ) then
    alter table public.ordenes_expedicion
      drop constraint ordenes_expedicion_estado_chk;
  end if;

  update public.ordenes_expedicion
    set estado = case
      when estado is null then 'pendiente'
      else lower(estado)
    end
  where estado is not null;

  update public.ordenes_expedicion
    set estado = case lower(coalesce(estado, 'pendiente'))
      when 'registrada' then 'pendiente'
      when 'registro' then 'pendiente'
      when 'creada' then 'pendiente'
      when 'preparacion' then 'preparando'
      when 'en_preparacion' then 'preparando'
      when 'preparando' then 'preparando'
      when 'lista' then 'lista'
      when 'listo' then 'lista'
      when 'despachado' then 'despachada'
      when 'finalizada' then 'despachada'
      when 'finalizado' then 'despachada'
      when 'despachada' then 'despachada'
      when 'anulada' then 'cancelada'
      when 'anulado' then 'cancelada'
      when 'cancelada' then 'cancelada'
      else 'pendiente'
    end;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ordenes_expedicion_estado_chk'
  ) then
    alter table public.ordenes_expedicion
      add constraint ordenes_expedicion_estado_chk
      check (estado in ('pendiente', 'preparando', 'lista', 'despachada', 'cancelada'));
  end if;
end;
$$;
