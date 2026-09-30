create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.coach_messages enable row level security;

create policy "coach messages read own"
on public.coach_messages for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "coach messages insert own"
on public.coach_messages for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "coach messages delete own"
on public.coach_messages for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, delete on public.coach_messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-videos',
  'coach-videos',
  false,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "coach videos upload own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'coach-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "coach videos read own folder"
on storage.objects for select
to authenticated
using (
  bucket_id = 'coach-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "coach videos delete own folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'coach-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
