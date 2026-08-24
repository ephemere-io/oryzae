-- Entry photos — 日記本文に添える写真の保管先。
--
-- board-photos (00006) と同じ構成だが、entry 側は公開 URL を entries.media_urls
-- (text[]) に直接持つため専用テーブルは作らず、Storage バケットと RLS だけを用意する。
-- パスの先頭セグメントを user_id にすることで、board と同じ「自分のフォルダにだけ
-- 書ける」ポリシーがそのまま使える。
insert into storage.buckets (id, name, public)
  values ('entry-photos', 'entry-photos', true)
  on conflict (id) do nothing;

create policy "entry_photos_upload" on storage.objects
  for insert with check (
    bucket_id = 'entry-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "entry_photos_read" on storage.objects
  for select using (bucket_id = 'entry-photos');

create policy "entry_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'entry-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
