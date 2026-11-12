import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export type AuditEntity = 'user' | 'role' | 'category' | 'addressee' | 'material';

export async function logAudit(input: {
  userId: number;
  entity: AuditEntity;
  entityId?: number | null;
  action: 'created' | 'updated' | 'deleted';
  title: string;
  payload?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        user_id: input.userId,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        action: input.action,
        title: input.title.slice(0, 300),
        payload: input.payload ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error('Не удалось записать историю', err);
  }
}

export function changedKeys(before: Record<string, unknown>, data: Record<string, unknown>): string[] {
  return Object.keys(data).filter((key) => {
    if (key === 'password') return true;
    return JSON.stringify(before[key]) !== JSON.stringify(data[key]);
  });
}
