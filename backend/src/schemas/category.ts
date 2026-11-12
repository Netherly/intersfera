import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(200),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1, 'Укажите название').max(200).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Нет полей для обновления' });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
