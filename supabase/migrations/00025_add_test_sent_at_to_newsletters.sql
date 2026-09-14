-- テスト配信の記録 (issue #614 フォロー)。
--
-- 本番配信の前に運営者だけへ送って受信確認する運用を入れる。その「いつテスト
-- したか」をここに持つ。送信そのもの (sent_at) とは別の欄にしてあるのは、
-- テストは何度でもやり直せる一方、本番配信は 1 回きりだから——同じ欄を使うと
-- 「テストしただけなのに配信済みに見える」状態が作れてしまう。
--
-- status は draft のまま動かない。テスト配信は配信ではない。
alter table public.newsletters
  add column if not exists test_sent_at timestamptz;

comment on column public.newsletters.test_sent_at is
  '最後に運営者へテスト配信した時刻。本番配信 (sent_at) とは独立で、何度でも更新される。';
