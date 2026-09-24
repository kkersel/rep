create table if not exists public.program_days (
  program_id text not null references public.programs(id) on delete cascade,
  day_index int not null check (day_index between 1 and 30),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null,
  kind text not null check (kind in ('training','recovery','summary')),
  level int not null default 0,
  target int not null default 0 check (target >= 0),
  status text not null check (status in ('upcoming','completed','failed','skipped')),
  actual_reps int check (actual_reps is null or actual_reps >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (program_id, day_index)
);

alter table public.program_days enable row level security;

drop policy if exists "program days owner all" on public.program_days;
create policy "program days owner all" on public.program_days
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.programs
    where programs.id = program_days.program_id
      and programs.user_id = (select auth.uid())
  )
);

grant select, insert, update on public.program_days to authenticated;
