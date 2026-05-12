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

export const createEntrySchema = z.object({
  content: z.string(),
  mediaUrls: z.array(z.string()).default([]),
  editorType: z.string(),
  editorVersion: z.string(),
  extension: z.record(z.unknown()).default({}),
  fermentationEnabled: z.boolean().optional(),
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
