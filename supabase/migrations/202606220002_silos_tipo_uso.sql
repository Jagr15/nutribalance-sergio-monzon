alter table public.silos
add column if not exists tipo_uso text not null default 'MATERIA_PRIMA';

alter table public.silos
add constraint silos_tipo_uso_check
check (tipo_uso in ('MATERIA_PRIMA', 'PRODUCTO_TERMINADO'));

update public.silos
set tipo_uso = case
  when lower(coalesce(nombre, '')) like '%lechera%'
    or lower(coalesce(nombre, '')) like '%cerdo%'
    or lower(coalesce(descripcion, '')) like '%producto terminado%'
    then 'PRODUCTO_TERMINADO'
  else 'MATERIA_PRIMA'
end
where tipo_uso is null
   or tipo_uso not in ('MATERIA_PRIMA', 'PRODUCTO_TERMINADO');
