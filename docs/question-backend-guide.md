# Question バックエンドガイド

Question（問い）コンテキストの実装ガイド。
横断的なルールは `docs/backend-architecture-guide.md` を参照。

---

## ディレクトリ構成

```
apps/server/src/contexts/question/
├── presentation/routes/
│   ├── questions.ts                  # /api/v1/questions ルート
│   └── entry-questions.ts            # /api/v1/entries/:entryId/questions ルート
├── application/
│   ├── usecases/                     # 13 ユースケース
│   │   ├── create-question.usecase.ts
│   │   ├── edit-question.usecase.ts
│   │   ├── get-question.usecase.ts
│   │   ├── list-active-questions.usecase.ts
│   │   ├── list-all-questions.usecase.ts
│   │   ├── list-pending-proposals.usecase.ts
│   │   ├── archive-question.usecase.ts
│   │   ├── unarchive-question.usecase.ts
│   │   ├── accept-question-proposal.usecase.ts
│   │   ├── reject-question-proposal.usecase.ts
│   │   ├── link-question-to-entry.usecase.ts
│   │   ├── unlink-question-from-entry.usecase.ts
│   │   └── list-entry-questions.usecase.ts
│   └── errors/
│       └── question.errors.ts
├── domain/
│   ├── models/
│   │   ├── question.ts               # Question class
│   │   └── question-transaction.ts    # QuestionTransaction class
│   ├── services/
│   │   └── current-question-text.service.ts
│   └── gateways/
│       ├── question-repository.gateway.ts
│       ├── question-transaction-repository.gateway.ts
│       └── entry-question-link-repository.gateway.ts
└── infrastructure/repositories/
    ├── supabase-question.repository.ts
    ├── supabase-question-transaction.repository.ts
    └── supabase-entry-question-link.repository.ts
```

---

## ドメインモデル

### Question

ユーザーの「問い」の親レコード。アーカイブ・承認・Oryzae 提案フラグを持つ。

```typescript
class Question {
  readonly id, userId, isArchived, isValidatedByUser, isProposedByOryzae, createdAt, updatedAt

  static create(params, generateId): Question  // バリデーション不要
  static fromProps(props): Question
  withArchived(): Question
  withUnarchived(): Question
  withValidated(): Question
  get isActive(): boolean  // !isArchived && isValidatedByUser
  toProps(): QuestionProps
}
```

### QuestionTransaction

問いの文面の版管理。append-only。最大64文字。

```typescript
class QuestionTransaction {
  readonly id, questionId, string, questionVersion, isValidatedByUser, isProposedByOryzae, createdAt, updatedAt

  static create(params, generateId): Result<QT, QTError>
  // バリデーション: 空文字禁止、64文字上限

  static fromProps(props): QuestionTransaction
  withValidated(): QuestionTransaction
  toProps(): QuestionTransactionProps
}
```

### EntryQuestionLink

Entry と Question の N:M 紐付け。ドメインモデル化しない（gateway のみ）。

### ドメインサービス

`resolveCurrentText(transactions)`: validated な transaction のうち最大 version のものを返す。

---

## ビジネスルール

- **アクティブな問い**: `is_archived=false AND is_validated_by_user=true`
- **最新文面**: 同一 question_id の validated transaction のうち `question_version` 最大
- **最大3つ**: ユーザーあたりアクティブ問い最大3
- **version 自動増加**: usecase が最新 version を取得して +1 を渡す
- **Oryzae 提案フロー**: 新規問い提案（Question 自体が unvalidated）と既存問い更新提案（Transaction が unvalidated）の2パターン

---

## API エンドポイント

```
POST   /api/v1/questions                     新規作成
GET    /api/v1/questions                     アクティブ問い一覧
GET    /api/v1/questions/all                 全問い一覧（アーカイブ含む）
GET    /api/v1/questions/pending             未承認提案一覧
GET    /api/v1/questions/:id                 問い詳細（版履歴含む）
PUT    /api/v1/questions/:id                 問い文面を編集
POST   /api/v1/questions/:id/archive         アーカイブ
POST   /api/v1/questions/:id/unarchive       復活
POST   /api/v1/questions/:id/accept          提案承認
POST   /api/v1/questions/:id/reject          提案却下

POST   /api/v1/entries/:entryId/questions/:questionId  紐付け
DELETE /api/v1/entries/:entryId/questions/:questionId  紐付け解除
GET    /api/v1/entries/:entryId/questions               紐付き問い一覧
```

---

## DB スキーマ

```sql
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_archived boolean not null default false,
  is_validated_by_user boolean not null default true,
  is_proposed_by_oryzae boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_transactions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  string text not null,
  question_version integer not null,
  is_validated_by_user boolean not null default true,
  is_proposed_by_oryzae boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, question_version),
  constraint chk_string_length check (char_length(string) <= 64)
);

create table public.entry_question_links (
  entry_id uuid not null references public.entries(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  primary key (entry_id, question_id)
);
```

---

## 変更ポイント早見表

| やりたいこと | 変更するファイル |
| --- | --- |
| Question のフラグ追加 | `domain/models/question.ts` → `QuestionProps` + class |
| Transaction のバリデーション変更 | `domain/models/question-transaction.ts` → validateString |
| 新ユースケース追加 | `application/usecases/` に新ファイル |
| API エンドポイント追加 | `presentation/routes/questions.ts` |
| DB カラム追加 | `supabase/migrations/` + repository |
