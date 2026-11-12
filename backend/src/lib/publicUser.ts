import { User, AppRole } from '@prisma/client';
import { DEPARTMENT_IDS } from './departments.js';
import { ALL_PERMISSION_KEYS } from './permissions.js';

// Убирает хэш пароля и добавляет вычисленные доступы + имя роли.
// Ожидает, что запрос включил role_ref (include: { role_ref: true }).
export function publicUser(user: User & { role_ref?: AppRole | null }) {
  const { password_hash: _password_hash, role_ref, ...rest } = user;
  const permissions =
    user.role === 'super_admin' ? ALL_PERMISSION_KEYS : role_ref?.permissions ?? [];
  const departments = user.role === 'super_admin' ? [...DEPARTMENT_IDS] : user.departments;
  const role_name = role_ref?.name ?? (user.role === 'super_admin' ? 'Супер-админ' : null);
  return { ...rest, permissions, departments, role_name };
}
