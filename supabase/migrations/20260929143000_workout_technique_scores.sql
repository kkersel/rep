alter table public.workout_sessions
  add column if not exists technique jsonb;

alter table public.coach_assessments
  add column if not exists score numeric(3,1),
  add column if not exists session_id text;

alter table public.coach_assessments
  drop constraint if exists coach_assessments_score_range;

alter table public.coach_assessments
  add constraint coach_assessments_score_range
  check (score is null or (score >= 1 and score <= 10));

create index if not exists coach_assessments_user_session_idx
  on public.coach_assessments (user_id, session_id)
  where session_id is not null;
