-- 「このカードは利用者が自分で動かしたか」を明示的に持つ。
--
-- これまでクライアントは z_index の値だけから推測していた:
--   自動採番のカード … 0, 1, 2, …, N-1（N = そのボードの枚数、作成日時順）
--   ドラッグしたカード … N 以上（手前に持ち上げる）
-- そのため判定は「z_index >= 総枚数」だった。
--
-- ところがカードを削除すると N が縮むため、触っていないカードが判定を満たしてしまう。
-- 例: 4枚のうち1枚を消すと、z_index=3 の自動採番カードが 3 >= 3 を満たして
-- 「利用者が動かした」扱いになり、作成日時順から外れて手前に固定される。
--
-- z_index の値からは「当時の N」を復元できないので、クライアント側でどんな式を書いても
-- 直らない。情報そのものを持たせる。
--
-- IF NOT EXISTS なので、既に列がある環境へ適用しても影響はない。
ALTER TABLE public.board_cards
  ADD COLUMN IF NOT EXISTS user_positioned boolean NOT NULL DEFAULT false;

-- 既存行の埋め戻し。
--
-- 既定値 false のままだと、これまで手で並べ替えたカードが一度だけ作成日時順に戻ってしまう。
-- 移行の瞬間に**現行の推測ロジックをそのまま1回だけ適用**して、見た目を保ったまま
-- 「以後ズレなくなる」状態へ移す（推測が当たっていた範囲はそのまま引き継がれ、
-- 外れていた分もこれ以上悪化しない）。
UPDATE public.board_cards AS c
SET user_positioned = true
FROM (
  SELECT user_id, date_key, view_type, count(*) AS total
  FROM public.board_cards
  WHERE is_deleted = false
  GROUP BY user_id, date_key, view_type
) AS g
WHERE c.user_id = g.user_id
  AND c.date_key = g.date_key
  AND c.view_type = g.view_type
  AND c.is_deleted = false
  AND c.z_index >= g.total;
