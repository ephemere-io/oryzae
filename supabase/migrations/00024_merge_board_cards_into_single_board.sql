-- ボードを「日付 × 日次/週次ごとの盤面」から「1 人に 1 枚のコルクボード」へまとめる。
--
-- これまでの board_cards は (date_key, view_type) ごとに別の盤面を持っていた。
-- 同じ付箋・写真でも日次の盤面と週次の盤面にそれぞれ 1 行ずつ居て（週次は開いたときに
-- 日次からコピーしていた）、位置も盤面ごとに別々だった。
-- 日付を切り替える・日次/週次を切り替えるという見方そのものをやめ、
-- **1 つの付箋・写真につき 1 行**にして、date_key / view_type を捨てる。
--
-- 適用順: **アプリを先にデプロイし、終わったらすぐに流す。**
--   - 旧アプリは date_key / view_type で絞って読むので、この SQL の後ではボードが開けない。
--   - 新アプリはこの SQL の前でもボードを開ける（同じカードが 2 枚見えることがある）が、
--     カードの新規作成だけは失敗する（date_key が NOT NULL のまま）。
--
-- 元に戻せない。捨てるのは「同じカードの、別の盤面での位置」と日付・表示単位の列だけで、
-- 付箋の本文・写真そのもの（board_snippets / board_photos）には触れない。

-- 1. 1 つの付箋・写真につき 1 行だけ残す -------------------------------------------
--
-- 優先順:
--   a. 貼ってある行（is_deleted = false）。どれか 1 つの盤面にでも貼ってあれば、
--      まとめた後のボードにも貼ってあるべき。どこでも剥がしてあれば、剥がした行を 1 つ残す。
--   b. 利用者が自分で置いた行（user_positioned）。自動配置のままのコピーより意図がある。
--   c. 最後に触った行（updated_at）。
-- ref_id で畳む（card_type は見ない）。旧来の一意制約も (user_id, ref_id, …) だった。
DELETE FROM public.board_cards AS c
USING (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, ref_id
      ORDER BY is_deleted ASC, user_positioned DESC, updated_at DESC, created_at ASC, id ASC
    ) AS rank_in_ref
  FROM public.board_cards
) AS ranked
WHERE c.id = ranked.id
  AND ranked.rank_in_ref > 1;

-- 2. 元の盤面ごとのかたまりを、重ならないように並べる -----------------------------
--
-- どの日の盤面でも、カードは同じあたり（初期配置は x:60-800 / y:60-600）に置かれている。
-- 座標のまま 1 枚に集めると、使ってきた人ほど全部が重なって読めなくなる。
--
-- そこで元の盤面（date_key × view_type）を 1 かたまりとし、かたまりの中の並びは
-- そのまま保って、かたまり同士を格子に並べる。
--   - 新しい盤面から順に、左 → 右、段を下へ。列数は盤面の数の平方根（正方形に近くなる）
--   - いちばん新しい盤面は動かさない（最後に触っていた場所がそのまま残る）
--   - 列の幅・段の高さは、その列・段でいちばん大きいかたまりに合わせ、間を 200 空ける
--     （1 つだけ遠くまで広げた盤面があっても、全体が間延びしない）
-- 盤面に出ない行（剥がした行・過去に置かれた日記）は動かさない。
WITH boards AS (
  SELECT
    user_id,
    date_key,
    view_type,
    min(x) AS min_x,
    min(y) AS min_y,
    max(x + width) - min(x) AS span_w,
    max(y + height) - min(y) AS span_h
  FROM public.board_cards
  WHERE is_deleted = false
    AND card_type IN ('snippet', 'photo')
  GROUP BY user_id, date_key, view_type
),
numbered AS (
  SELECT
    boards.*,
    row_number() OVER (PARTITION BY user_id ORDER BY date_key DESC, view_type ASC) - 1 AS n,
    ceil(sqrt(count(*) OVER (PARTITION BY user_id)))::bigint AS cols
  FROM boards
),
cells AS (
  SELECT numbered.*, n % cols AS grid_col, n / cols AS grid_row
  FROM numbered
),
col_x AS (
  SELECT
    user_id,
    grid_col,
    coalesce(
      sum(max(span_w) + 200) OVER (
        PARTITION BY user_id ORDER BY grid_col
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS offset_x
  FROM cells
  GROUP BY user_id, grid_col
),
row_y AS (
  SELECT
    user_id,
    grid_row,
    coalesce(
      sum(max(span_h) + 200) OVER (
        PARTITION BY user_id ORDER BY grid_row
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS offset_y
  FROM cells
  GROUP BY user_id, grid_row
),
origin AS (
  SELECT user_id, min_x AS origin_x, min_y AS origin_y
  FROM cells
  WHERE n = 0
),
shifts AS (
  SELECT
    cells.user_id,
    cells.date_key,
    cells.view_type,
    origin.origin_x + col_x.offset_x - cells.min_x AS dx,
    origin.origin_y + row_y.offset_y - cells.min_y AS dy
  FROM cells
  JOIN origin ON origin.user_id = cells.user_id
  JOIN col_x ON col_x.user_id = cells.user_id AND col_x.grid_col = cells.grid_col
  JOIN row_y ON row_y.user_id = cells.user_id AND row_y.grid_row = cells.grid_row
)
UPDATE public.board_cards AS c
SET
  x = c.x + shifts.dx,
  y = c.y + shifts.dy
FROM shifts
WHERE c.user_id = shifts.user_id
  AND c.date_key = shifts.date_key
  AND c.view_type = shifts.view_type
  AND c.is_deleted = false
  AND c.card_type IN ('snippet', 'photo')
  AND (shifts.dx <> 0 OR shifts.dy <> 0);

-- 3. 盤面の鍵（date_key × view_type）を外し、「1 つの付箋・写真につき 1 枚」を制約にする --
DROP INDEX IF EXISTS public.idx_board_cards_unique_ref;
DROP INDEX IF EXISTS public.idx_board_cards_user_date;
DROP INDEX IF EXISTS public.idx_board_cards_active;

ALTER TABLE public.board_cards
  DROP COLUMN IF EXISTS date_key,
  DROP COLUMN IF EXISTS view_type;

-- ボードを開くとき（その人のカード全部）もこの索引で引ける（先頭が user_id）。
CREATE UNIQUE INDEX IF NOT EXISTS idx_board_cards_user_ref
  ON public.board_cards (user_id, ref_id);
