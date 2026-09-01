import { z } from 'zod';

/**
 * メール文面などサーバー側で使うユーザーのロケール。
 * クライアントの next-intl `useLocale()` 値を Supabase の user_metadata に保存して、
 * 確認メール・再設定メールなどのテンプレートで言語分岐に使う。
 *
 * UI は 4 言語 (ja/en/zh/ko) をサポート。発酵レター等の LLM プロンプトは
 * 現状 ja/en のみ対応のため、サーバー側 (SupabaseUserLocaleResolver) で
 * zh/ko → en にフォールバックする。Issue #308 参照。
 */
export const localeSchema = z.enum(['ja', 'en', 'zh', 'ko']);
export type LocaleCode = z.infer<typeof localeSchema>;

/**
 * Editor visual effects state — persisted per-entry so traces re-appear on reload.
 * See `docs/editor-effects-persistence.md` for the design rationale.
 *
 * `version` lets us evolve the shape without breaking old clients: unknown
 * versions / kinds are ignored on apply so older clients gracefully degrade.
 */
const eraserTraceSchema = z.object({
  rx: z.number(),
  ry: z.number(),
  w: z.number(),
  h: z.number(),
  chars: z.array(z.string()),
  intensity: z.number(),
  seed: z.number(),
});

const textSpanMarkSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('time'),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    mode: z.enum(['fontSize', 'fontWeight']),
    t: z.number(),
    duration: z.number(),
  }),
  z.object({
    kind: z.literal('pressure'),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    intensity: z.number(),
    seed: z.number(),
  }),
  z.object({
    kind: z.literal('voice'),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    fontSizeEm: z.number(),
  }),
]);

/**
 * 本文中に置いた写真 1 枚。
 *
 * **`offset` は本文の文字位置**で、そこに 1 文字だけ置かれた
 * `INLINE_IMAGE_PLACEHOLDER`（U+FFFC）と 1 対 1 で対応する。プレースホルダを本文側に
 * 持たせるのは、位置をテキスト編集そのものに追従させるため —— 文字を消せば写真も消え、
 * 前に文字を足せば写真も後ろへずれる。オフセットだけを別管理すると、この追従を
 * 自前で書くことになり必ずズレる。
 *
 * `storagePath` は `entries.media_urls` に入っている値と一致していなければならない
 * （表示用の署名付き URL は都度サーバーが発行する）。本文から消えた写真は
 * media_urls にも残らないので、両者は同じ集合を指す。
 */
const inlineImageSchema = z.object({
  /** 本文中のプレースホルダ位置。`content` の文字オフセット。 */
  offset: z.number().int().nonnegative(),
  /** Storage 上のパス。`mediaUrls` の要素と一致する。 */
  storagePath: z.string(),
  /**
   * 表示幅。本文の折り返し幅に対する割合（0.05〜1.0）。
   * px ではなく割合にしてあるのは、縦書き / 横書きや画面幅でレイアウト幅が変わるため。
   * px で持つと、書いたときと違う端末で開いたときに本文との比率が崩れる。
   */
  widthRatio: z.number().min(0.05).max(1),
  /**
   * 回り込み。Word の「文字列の折り返し」に相当するが、**縦書きでも意味が通る名前**にしてある
   * （Word の「上下」は縦書きだと左右になるため、方向を含む名前は使えない）。
   *   - `inline` : 文字と同じ流れに置く（大きな 1 文字として振る舞う）
   *   - `block`  : 独立した行を占める。前後に本文が来る
   *   - `wrap`   : 本文が写真を避けて回り込む（float 相当）
   */
  layout: z.enum(['inline', 'block', 'wrap']),
  /**
   * 行方向の寄せ。`block` / `wrap` のときだけ意味を持つ（`inline` は文字の流れが決める）。
   * `start` / `end` は書字方向に依存しない —— 横書きなら左右、縦書きなら上下になる。
   */
  align: z.enum(['start', 'center', 'end']),
  /**
   * 縦横比の上書き（block 方向 ÷ inline 方向）。辺ハンドルで自由変形したときだけ入る。
   * 未指定なら写真本来の比率を使う（角ハンドルは比率を保つので値を書かない）。
   */
  aspect: z.number().positive().optional(),
});

export const editorEffectsStateSchema = z.object({
  version: z.literal(1),
  eraserTraces: z.array(eraserTraceSchema).optional(),
  textSpans: z.array(textSpanMarkSchema).optional(),
  /** 本文中に置いた写真。`offset` 昇順である必要はない（読み込み時に整列する）。 */
  inlineImages: z.array(inlineImageSchema).optional(),
});

export type EditorEffectsState = z.infer<typeof editorEffectsStateSchema>;
export type EraserTracePayload = z.infer<typeof eraserTraceSchema>;
export type TextSpanMark = z.infer<typeof textSpanMarkSchema>;
export type InlineImage = z.infer<typeof inlineImageSchema>;

export const createEntrySchema = z.object({
  content: z.string(),
  // undefined → 既存値を維持（更新時）/ 配列 → 差し替え。effects と同じ扱いにしてあるのは、
  // 自動保存が写真を知らないまま本文だけ送ってきても media_urls を消さないため。
  mediaUrls: z.array(z.string()).optional(),
  editorType: z.string(),
  editorVersion: z.string(),
  extension: z.record(z.unknown()).default({}),
  fermentationEnabled: z.boolean().optional(),
  // undefined → 既存値を維持 / null → 明示的にクリア / object → 差し替え
  effects: editorEffectsStateSchema.nullable().optional(),
});

export const questionStringSchema = z.object({
  string: z.string().min(1).max(64),
});

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  nickname: z
    .string()
    .min(2, 'ニックネームは2文字以上')
    .max(30, 'ニックネームは30文字以下')
    .regex(/^[a-zA-Z0-9_-]+$/, '英数字、ハイフン、アンダースコアのみ使用可能'),
  email: z.string().email(),
  password: z.string().min(6),
  locale: localeSchema.optional(),
  /**
   * Supabase の確認メールに埋め込む redirect 先 (`{{ .RedirectTo }}`)。
   * Vercel preview など本番外の環境からサインアップしたとき、ダッシュボード設定の
   * Site URL ではなく、実際にサインアップフォームが置かれていた origin に
   * 戻ってきて確認フローを完了させるためにクライアントから明示的に送る。
   * 通常 `${window.location.origin}/auth/confirm` を渡す。
   */
  emailRedirectTo: z.string().url().optional(),
});

export const oauthInitSchema = z.object({
  redirectTo: z.string().url(),
  locale: localeSchema.optional(),
});

export const oauthCallbackSchema = z.object({
  code: z.string(),
  locale: localeSchema.optional(),
});

/**
 * Implicit OAuth flow の仕上げ用ペイロード。
 *
 * Supabase の `flowType: 'implicit'` (デフォルト) では Google からの redirect が
 * URL fragment にトークンを返す。クライアントはそのトークンで Bearer 認証して
 * このエンドポイントを叩き、サーバ側で profile 作成と Research Preview 登録枠
 * チェックを行う。詳細は Issue #307。
 */
export const oauthFinalizeSchema = z.object({
  locale: localeSchema.optional(),
});

/**
 * Supabase Auth のメール確認系トークンタイプ。
 * Microsoft (Outlook) は差出人ドメインとリンク先ドメインが乖離していると
 * メールをサイレントに破棄する。{{ .ConfirmationURL }} だと supabase.co を
 * 指してしまうため、{{ .TokenHash }} + 自社ドメイン経由の verifyOtp フローに
 * 切り替え、リンクドメインを oryzae.ephemere.io に揃えている。
 */
export const emailOtpTypeSchema = z.enum([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
]);
export type EmailOtpType = z.infer<typeof emailOtpTypeSchema>;

export const verifyOtpSchema = z.object({
  tokenHash: z.string().min(1),
  type: emailOtpTypeSchema,
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  nickname: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  avatarUrl: z.string().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email(),
});

export const completeOnboardingSchema = z.object({
  completed: z.literal(true),
});

// Board schemas
export const boardQuerySchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const boardCardUpdateSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string().uuid(),
      x: z.number(),
      y: z.number(),
      rotation: z.number(),
      width: z.number().min(120),
      height: z.number().min(120),
      zIndex: z.number().int(),
      // 利用者が自分で動かしたカードか。未送信のクライアント（古いタブ等）は false 扱い。
      userPositioned: z.boolean().optional(),
    }),
  ),
});

export const boardSnippetCreateSchema = z.object({
  text: z.string().min(1).max(50),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  viewType: z.enum(['daily', 'weekly']).optional(),
});

export const boardSnippetUpdateSchema = z.object({
  text: z.string().min(1).max(50),
});

/**
 * Jar 画面のドラッグ&ドロップ位置保存。
 * - questions: 円本体（jar 全体に対する % 位置）
 * - keywords / snippets / letters: 円の中の要素（QuestionCircle に対する % 位置）
 *
 * 各座標は 0–100 のパーセンテージ（クライアントでクランプ済みの想定）。
 */
const jarPositionItemSchema = z.object({
  id: z.string().uuid(),
  jarX: z.number().min(0).max(100),
  jarY: z.number().min(0).max(100),
});

export const jarLayoutUpdateSchema = z.object({
  questions: z.array(jarPositionItemSchema).default([]),
  keywords: z.array(jarPositionItemSchema).default([]),
  snippets: z.array(jarPositionItemSchema).default([]),
  letters: z.array(jarPositionItemSchema).default([]),
});

export type JarLayoutUpdate = z.infer<typeof jarLayoutUpdateSchema>;
export type JarPositionItem = z.infer<typeof jarPositionItemSchema>;
