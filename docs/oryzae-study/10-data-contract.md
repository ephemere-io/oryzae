# 10 — データ契約

## 書斎が読むもの

書斎は1つの読み取り専用ビューモデル `StudyState` を受け取る。プロトタイプの
`mock/study-state.presets.json` がその実体（6プリセット）。

```ts
interface StudyState {
  now: string;                       // YYYY-MM-DD（ローカル暦日）
  profile: { nickname: string; initial: string; avatarUrl?: string | null };
  unreadCount: number;               // useUnreadLetters().unreadCount
  fermentation: {
    readiness: number;               // 0..1 ※上流に無い。下記参照
    status: 'idle' | 'fermenting' | 'completed';
    letters: InboxLetter[];          // features/shared/fermentation/types.ts
  };
  questions: QuestionItem[];         // features/shared/questions/types.ts
  words: string[];                   // 直近の FermentationKeyword.keyword
  notebooks: Notebook[];             // 月ごとの手帳（下記）
  entries: StudyEntry[];             // 一覧オーバーレイ用
  board: { total: number; snippets: number; photos: number; cards: StudyBoardCard[] };
}

interface Notebook { month: string; entryCount: number; current: boolean }   // month = 'YYYY-MM'

interface StudyEntry {               // use-entries.ts の Entry から派生
  id: string;
  createdAt: string;
  excerpt: string;                   // content の先頭1文（サーバー側で切るのが望ましい）
  chars: number;                     // content.length
  linkedQuestions: { id: string; currentText: string | null }[];
  pickled: boolean;                  // 問いにリンク済み＝漬けた
}

interface StudyBoardCard {           // BoardCardData のサブセット + lines
  id: string;
  cardType: 'snippet' | 'photo';
  x: number; y: number;              // world 座標（無制限・負値可）
  rotation: number;                  // 度
  width: number; height: number;     // >= MIN_CARD_SIZE (120)
  zIndex: number;
  lines: number;                     // 抽象カードの罫線数。snippet の本文長から算出
}
```

## 既存 API との対応

| StudyState | 既存の取得元 | 備考 |
| --- | --- | --- |
| `entries` | `GET /api/v1/entries?limit=20&order=newest`（`use-entries.ts`） | `linkedQuestions` はサーバーが埋めて返す |
| `board` | `GET /api/v1/board/summary`（`use-board-summary.ts`） | 日付で絞らない。`total` と内訳は ref で畳んだ数 |
| `questions` | `GET /api/v1/questions`（`use-questions.ts`） | 生存は最大3件 |
| `fermentation.letters` | `GET /api/v1/fermentations` → `status === 'completed'`（`use-unread-letters.ts`） | 受信箱は問いごとに最新1通 |
| `unreadCount` | `useUnreadLetters()`（既に `(protected)/layout.tsx` で1回だけ取得） | N+1 を増やさない |
| `words` | `GET /api/v1/fermentations/:id` の `keywords[].keyword` | 詳細は重い。書斎用に要約が要る |
| `notebooks` | **無い** | 下記 |
| `fermentation.readiness` | **無い** | 下記 |

## 不足しているもの（先に決める）

### 1. `readiness`（0..1）

上流にあるのは `FermentationSummary.status` だけで、進み具合を表す値は無い。書斎の瓶は
これが無いと成立しない。案は2つ。

- **A: サーバーが返す**（推奨）— `GET /api/v1/fermentations/readiness` を追加し、
  スケジューラが次に発酵を回す条件（対象期間・漬けた記録の数・前回からの経過）から算出して
  `{ readiness, status, nextRunAt }` を返す。UI が発酵条件を再実装しなくて済む。
- **B: クライアントで近似** — `pickledSinceLastFermentation / threshold` と経過日数の
  小さい方。手軽だがサーバーの条件が変わると嘘になる。フラグ初期の暫定としてのみ。

どちらでも UI 側の契約は `0..1` の1値 + `status` に固定する。

### 2. `notebooks`（月ごとの冊数と厚み）

`GET /api/v1/entries/monthly-counts` 相当（`[{ month: 'YYYY-MM', count: n }]`）が必要。
既存の一覧をページングして数えると、書斎を開くたびに全件取得になる。

### 3. `excerpt`

一覧オーバーレイは本文冒頭だけを見せる。`content` 全文を持ってくるのは無駄なので、
`GET /api/v1/entries` に `excerpt`（先頭1文・全角60字上限）と `chars` を足すのが望ましい。
当面はクライアントで `content` から切って良い。

## 応答例（発酵完了時）

```json
{
  "readiness": 1,
  "status": "completed",
  "nextRunAt": null,
  "letters": [
    {
      "questionId": "q-2",
      "questionText": "人にとってジャーナリングを続けることの意味とは何か？",
      "fermentationId": "f-1",
      "createdAt": "2026-09-02T05:00:00+09:00"
    }
  ]
}
```

失敗時の扱い: 書斎は**部分的な失敗で落とさない**。board が取れなければ壁は空、
notebooks が取れなければ机は空、readiness が取れなければ瓶は `status: 'idle'` の見た目
（泡4つ・液面最小）にする。エラー表示は各画面に入ってから既存の `ErrorState` に任せる。
