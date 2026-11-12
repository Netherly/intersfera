import { z } from 'zod';

export const MATERIAL_KINDS = ['norm', 'phrase', 'example'] as const;

export const createMaterialSchema = z.object({
  kind: z.enum(MATERIAL_KINDS),
  title: z.string().trim().min(1, 'Укажите название').max(500),
  citation: z.string().trim().max(500).optional(),
  body: z.string().max(200_000).optional(),
});

export const updateMaterialSchema = z
  .object({
    title: z.string().trim().min(1, 'Укажите название').max(500).optional(),
    citation: z.string().trim().max(500).optional(),
    body: z.string().max(200_000).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Нет полей для обновления' });

export const listMaterialsSchema = z.object({
  kind: z.enum(MATERIAL_KINDS).optional(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
