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
