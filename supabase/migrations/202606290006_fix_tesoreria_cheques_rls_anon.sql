alter table public.tesoreria_cheques
  enable row level security;

drop policy if exists "tesoreria_cheques_select_public" on public.tesoreria_cheques;
drop policy if exists "tesoreria_cheques_insert_public" on public.tesoreria_cheques;
drop policy if exists "tesoreria_cheques_update_public" on public.tesoreria_cheques;
drop policy if exists "tesoreria_cheques_delete_public" on public.tesoreria_cheques;

create policy "tesoreria_cheques_select_public"
on public.tesoreria_cheques
for select
to anon, authenticated
using (true);

create policy "tesoreria_cheques_insert_public"
on public.tesoreria_cheques
for insert
to anon, authenticated
with check (true);

create policy "tesoreria_cheques_update_public"
on public.tesoreria_cheques
for update
to anon, authenticated
using (true)
with check (true);

create policy "tesoreria_cheques_delete_public"
on public.tesoreria_cheques
for delete
to anon, authenticated
using (true);
