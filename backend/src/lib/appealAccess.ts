import { Prisma } from '@prisma/client';

export const VIEW_UNASSIGNED = 'appeals.view_unassigned';

export interface AppealActor {
  id: number;
  role: string;
  permissions: string[];
}

// Супер-админ видит все. Остальные видят свои.
// Нейтральные (без ответственного) только при отдельном доступе.
export function appealVisibilityWhere(actor: AppealActor): Prisma.AppealWhereInput {
  if (actor.role === 'super_admin') return {};
  if (actor.permissions.includes(VIEW_UNASSIGNED)) {
    return { OR: [{ assignee_id: actor.id }, { assignee_id: null }] };
  }
  return { assignee_id: actor.id };
}

export function canSeeAppeal(assigneeId: number | null, actor: AppealActor): boolean {
  if (actor.role === 'super_admin') return true;
  if (assigneeId === actor.id) return true;
  return assigneeId === null && actor.permissions.includes(VIEW_UNASSIGNED);
}
