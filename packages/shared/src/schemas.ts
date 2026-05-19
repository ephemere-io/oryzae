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

/**
 * `time` variant stores the **resolved** font size (px) or font weight that the
 * span was rendered with. We don't keep the `t` normalization because the
 * effective size depends on `settings.fontSize` at composition time — re-deriving
 * from `t` alone on restore would shrink/grow the text whenever the editor's
 * base font size differs from the assumed default.
 *
 * Two `kind: 'time'` variants prevent us from using `z.discriminatedUnion('kind')`.
 * `z.union` works — slightly slower parse for a small schema, fine here.
 */
const textSpanMarkSchema = z.union([
  z.object({
    kind: z.literal('time'),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    mode: z.literal('fontSize'),
    fontSize: z.number().positive(),
  }),
  z.object({
    kind: z.literal('time'),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    mode: z.literal('fontWeight'),
    fontWeight: z.number().int().positive(),
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

export const editorEffectsStateSchema = z.object({
  version: z.literal(1),
  eraserTraces: z.array(eraserTraceSchema).optional(),
  textSpans: z.array(textSpanMarkSchema).optional(),
});

export type EditorEffectsState = z.infer<typeof editorEffectsStateSchema>;
export type EraserTracePayload = z.infer<typeof eraserTraceSchema>;
export type TextSpanMark = z.infer<typeof textSpanMarkSchema>;

export const createEntrySchema = z.object({
  content: z.string(),
  mediaUrls: z.array(z.string()).default([]),
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
