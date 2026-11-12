import { z } from 'zod';
import { DEPARTMENT_IDS } from '../lib/departments.js';

const departments = z.array(z.enum(DEPARTMENT_IDS));

export const createUserSchema = z
  .object({
    full_name: z.string().min(1, 'Укажите ФИО'),
    login: z.string().min(3, 'Логин минимум 3 символа'),
    password: z.string().min(4, 'Пароль минимум 4 символа'),
    role: z.enum(['user', 'super_admin']).default('user'),
    // роль-набор доступов (для обычных пользователей); у супер-админа не требуется
    role_id: z.coerce.number().int().positive().nullable().optional(),
    departments: departments.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'super_admin' && (!data.departments || data.departments.length === 0)) {
      ctx.addIssue({ code: 'custom', message: 'Выберите хотя бы один отдел', path: ['departments'] });
    }
  });

export const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  login: z.string().min(3).optional(),
  password: z.string().min(4).optional(),
  role: z.enum(['user', 'super_admin']).optional(),
  role_id: z.coerce.number().int().positive().nullable().optional(),
  departments: departments.optional(),
  is_active: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
