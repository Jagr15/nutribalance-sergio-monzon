alter table public.tesoreria_cheques
  enable row level security;

drop policy if exists "tesoreria_cheques_select_authenticated" on public.tesoreria_cheques;
drop policy if exists "tesoreria_cheques_insert_authenticated" on public.tesoreria_cheques;
drop policy if exists "tesoreria_cheques_update_authenticated" on public.tesoreria_cheques;
drop policy if exists "tesoreria_cheques_delete_authenticated" on public.tesoreria_cheques;

create policy "tesoreria_cheques_select_authenticated"
on public.tesoreria_cheques
for select
to authenticated
using (true);

create policy "tesoreria_cheques_insert_authenticated"
on public.tesoreria_cheques
for insert
to authenticated
with check (true);

create policy "tesoreria_cheques_update_authenticated"
on public.tesoreria_cheques
for update
to authenticated
using (true)
with check (true);

create policy "tesoreria_cheques_delete_authenticated"
on public.tesoreria_cheques
for delete
to authenticated
using (true);
