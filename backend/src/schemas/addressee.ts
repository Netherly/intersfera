import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .max(200)
  .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Укажите корректную почту');

export const createAddresseeSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(200),
  email: emailField.optional().default(''),
});

export const updateAddresseeSchema = z
  .object({
    name: z.string().trim().min(1, 'Укажите название').max(200).optional(),
    email: emailField.optional(),
    is_active: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Нет полей для обновления' });

export type UpdateAddresseeInput = z.infer<typeof updateAddresseeSchema>;
