create table if not exists public.coach_technique_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_issues jsonb not null default '[]'::jsonb check (jsonb_typeof(active_issues) = 'array'),
  resolved_issues jsonb not null default '[]'::jsonb check (jsonb_typeof(resolved_issues) = 'array'),
  strengths jsonb not null default '[]'::jsonb check (jsonb_typeof(strengths) = 'array'),
  assessments_count integer not null default 0 check (assessments_count >= 0),
  last_focus text not null default '',
  last_assessed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  improved_issue_codes text[] not null default '{}',
  strengths jsonb not null default '[]'::jsonb check (jsonb_typeof(strengths) = 'array'),
  lesson_id text check (lesson_id is null or lesson_id in ('hips_sag', 'hips_high', 'elbows_flared', 'hands_too_wide', 'shallow_depth')),
  next_step text not null default '',
  next_shot text check (next_shot is null or next_shot in ('front', 'side', 'diagonal')),
  model text not null default '',
  mode text not null check (mode in ('direct', 'insights')),
  created_at timestamptz not null default now()
);

create index if not exists coach_assessments_user_created_idx
on public.coach_assessments (user_id, created_at desc);

alter table public.coach_technique_profiles enable row level security;
alter table public.coach_assessments enable row level security;

create policy "coach technique profile read own"
on public.coach_technique_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "coach assessments read own"
on public.coach_assessments for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.coach_technique_profiles to authenticated;
grant select on public.coach_assessments to authenticated;
