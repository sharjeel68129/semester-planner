-- Large outlines (over 4 MB): the browser puts the file in this private bucket, because the web host refuses
-- requests over about 4.5 MB. The server reads it once and deletes it straight away (app/api/extract/route.js).
-- Run this once in the Supabase SQL editor. Free plan: up to 50 MB per file; files are deleted after reading,
-- so the 1 GB storage allowance is never filled.

insert into storage.buckets (id, name, public, file_size_limit)
values ('outlines', 'outlines', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- Each student may only touch files in their own folder: outlines/<their user id>/...
drop policy if exists "add own outline" on storage.objects;
create policy "add own outline" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'outlines' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "read own outline" on storage.objects;
create policy "read own outline" on storage.objects
  for select to authenticated
  using (bucket_id = 'outlines' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own outline" on storage.objects;
create policy "delete own outline" on storage.objects
  for delete to authenticated
  using (bucket_id = 'outlines' and (storage.foldername(name))[1] = auth.uid()::text);
