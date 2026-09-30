create table if not exists public.coach_reference_sources (
  id text primary key,
  title text not null,
  author text not null,
  url text not null unique,
  published_at date,
  view_count bigint,
  like_count bigint,
  source_score smallint not null check (source_score between 0 and 10),
  variation text not null default 'standard',
  useful_views text[] not null default '{}',
  review_status text not null default 'needs_clip_review'
    check (review_status in ('needs_clip_review', 'approved', 'rejected')),
  approved_clips jsonb not null default '[]'::jsonb,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_reference_profiles (
  id bigint generated always as identity primary key,
  version integer not null,
  variation text not null,
  view text not null check (view in ('front', 'side', 'diagonal')),
  source_count integer not null check (source_count >= 0),
  rep_count integer not null check (rep_count >= 0),
  ranges jsonb not null,
  canonical boolean not null default false,
  source_ids text[] not null default '{}',
  generated_at timestamptz not null default now(),
  unique (version, variation, view)
);

alter table public.coach_reference_sources enable row level security;
alter table public.coach_reference_profiles enable row level security;

revoke all on public.coach_reference_sources from anon, authenticated;
revoke all on public.coach_reference_profiles from anon, authenticated;

insert into public.coach_reference_sources
  (id, title, author, url, published_at, view_count, like_count, source_score, variation, useful_views, notes)
values
  ('calimove-perfect-pushup', 'The Perfect Push Up | Do it right!', 'Calisthenicmovement', 'https://www.youtube.com/watch?v=IODxDxX7oi4', '2016-06-16', 40989807, 690000, 10, 'standard', array['side','diagonal'], 'Use only uninterrupted demonstrations explicitly presented as correct form.'),
  ('fitnessfaqs-common-mistakes', 'NEVER DO PUSHUPS LIKE THIS | 10 Most Common Mistakes', 'FitnessFAQs', 'https://www.youtube.com/watch?v=lnR_kb5Wjf8', '2018-04-05', 11780364, 117000, 10, 'standard', array['side','diagonal'], 'Exclude every segment that demonstrates a named mistake or a non-standard variation.'),
  ('jeremy-ethier-pushup-strength', 'How To Unlock Your Push Up Strength (In 5 Minutes)', 'Jeremy Ethier', 'https://www.youtube.com/watch?v=Z88Rl5bpnmI', '2021-07-25', 6521434, 250000, 10, 'standard', array['front','side','diagonal'], 'Retain only full-body, uncut repetitions.'),
  ('nasm-proper-pushup', 'How to do a Push-Up | Proper Form & Technique', 'National Academy of Sports Medicine', 'https://www.youtube.com/watch?v=WDIpL0pjun0', '2021-04-28', 1044919, 4900, 10, 'standard', array['side','diagonal'], 'Institutional reference for neutral spine, controlled depth and head position.'),
  ('squat-university-pushups', 'Your Push-Ups Are WRONG (Here’s Why)', 'Squat University', 'https://www.youtube.com/watch?v=Yd1grZkAark', '2025-07-05', 107361, 5100, 10, 'standard', array['front','side','diagonal'], 'Exclude correction demonstrations and progressions.')
on conflict (id) do update set
  title = excluded.title,
  author = excluded.author,
  view_count = excluded.view_count,
  like_count = excluded.like_count,
  useful_views = excluded.useful_views,
  notes = excluded.notes,
  updated_at = now();
