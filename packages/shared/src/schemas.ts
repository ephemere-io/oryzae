import { z } from 'zod';

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
