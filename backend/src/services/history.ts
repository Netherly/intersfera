import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { appealVisibilityWhere, type AppealActor } from '../lib/appealAccess.js';

export interface HistoryQuery {
  source: 'all' | 'incoming' | 'outgoing' | 'admin';
  user_id?: number;
  before?: Date;
  limit: number;
}

export interface HistoryItem {
  key: string;
  source: 'incoming' | 'outgoing' | 'admin';
  created_at: string;
  user: { id: number; full_name: string } | null;
  action: string;
  payload: unknown;
  appeal: { id: number; number: string; sender: string } | null;
  entity: string | null;
  title: string;
}

export async function listHistory(query: HistoryQuery, actor: AppealActor & { departments: string[] }) {
  const isAdmin = actor.role === 'super_admin';
  const seesAppeals =
    isAdmin || (actor.departments.includes('appeals') && actor.permissions.includes('appeals.view'));
  const take = query.limit + 1;
  const timeFilter = query.before ? { lt: query.before } : undefined;

  const wantsAppeals = seesAppeals && query.source !== 'admin';
  const wantsAdmin = isAdmin && (query.source === 'all' || query.source === 'admin');

  const appealWhere: Prisma.AppealWhereInput = { AND: [appealVisibilityWhere(actor)] };
  if (query.source === 'incoming' || query.source === 'outgoing') {
    (appealWhere.AND as Prisma.AppealWhereInput[]).push({ direction: query.source });
  }

  const [appealEvents, auditEvents] = await Promise.all([
    wantsAppeals
      ? prisma.appealEvent.findMany({
          where: {
            appeal: appealWhere,
            ...(query.user_id ? { user_id: query.user_id } : {}),
            ...(timeFilter ? { created_at: timeFilter } : {}),
          },
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
          take,
          include: {
            user: { select: { id: true, full_name: true } },
            appeal: { select: { id: true, incoming_number: true, sender: true, direction: true } },
          },
        })
      : Promise.resolve([]),
    wantsAdmin
      ? prisma.auditEvent.findMany({
          where: {
            ...(query.user_id ? { user_id: query.user_id } : {}),
            ...(timeFilter ? { created_at: timeFilter } : {}),
          },
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
          take,
          include: { user: { select: { id: true, full_name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const merged: (HistoryItem & { at: number })[] = [
    ...appealEvents.map((event) => ({
      key: `a${event.id}`,
      source: (event.appeal.direction === 'outgoing' ? 'outgoing' : 'incoming') as HistoryItem['source'],
      created_at: event.created_at.toISOString(),
      at: event.created_at.getTime(),
      user: event.user,
      action: event.action,
      payload: event.payload,
      appeal: { id: event.appeal.id, number: event.appeal.incoming_number, sender: event.appeal.sender },
      entity: null,
      title: '',
    })),
    ...auditEvents.map((event) => ({
      key: `s${event.id}`,
      source: 'admin' as const,
      created_at: event.created_at.toISOString(),
      at: event.created_at.getTime(),
      user: event.user,
      action: event.action,
      payload: event.payload,
      appeal: null,
      entity: event.entity,
      title: event.title,
    })),
  ].sort((a, b) => b.at - a.at);

  const page = merged.slice(0, query.limit);
  const hasMore = merged.length > query.limit;
  return {
    items: page.map(({ at: _at, ...item }) => item),
    next_before: hasMore && page.length ? page[page.length - 1].created_at : null,
  };
}
