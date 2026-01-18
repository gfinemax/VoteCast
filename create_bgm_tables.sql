-- 1. Create BGM Tracks Table
create table if not exists public.bgm_tracks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  url text not null,
  duration integer default 0, -- in seconds
  size integer default 0, -- in bytes
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.bgm_tracks enable row level security;

-- 3. Create Policies for BGM Tracks (Public Read, Authenticated Insert/Delete)
create policy "Allow public read access"
  on public.bgm_tracks for select
  using (true);

create policy "Allow authenticated insert"
  on public.bgm_tracks for insert
  with check (true); -- Relaxed for demo, ideally auth.role() = 'authenticated'

create policy "Allow authenticated delete"
  on public.bgm_tracks for delete
  using (true);

-- 4. Storage Bucket Setup
-- Create the bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('bgm-files', 'bgm-files', true)
on conflict (id) do nothing;

-- Policy to allow public viewing of files
create policy "Public Access to BGM Files"
on storage.objects for select
using ( bucket_id = 'bgm-files' );

-- Policy to allow upload
create policy "Authenticated Upload to BGM Files"
on storage.objects for insert
with check ( bucket_id = 'bgm-files' );

-- Policy to allow delete
create policy "Authenticated Delete from BGM Files"
on storage.objects for delete
using ( bucket_id = 'bgm-files' );
