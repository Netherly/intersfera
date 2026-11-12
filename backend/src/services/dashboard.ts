import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { formatDateOnly, parseDateOnly } from '../lib/dates.js';
import { appealVisibilityWhere, type AppealActor } from '../lib/appealAccess.js';
import { APPEAL_STATUSES } from '../schemas/appeal.js';

const CLOSED = 'Завершено';

function todayMoscow(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const date = parseDateOnly(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

function label(value: string): string {
  const name = value.trim();
  return name || 'Не указано';
}

function scoped(actor: AppealActor, extra: Prisma.AppealWhereInput = {}): Prisma.AppealWhereInput {
  return { AND: [appealVisibilityWhere(actor), { direction: 'incoming' }, extra] };
}

export async function getDashboard(actor: AppealActor) {
  const today = todayMoscow();
  const horizon = addDays(today, 14);
  const todayDate = parseDateOnly(today);
  const horizonDate = parseDateOnly(horizon);
  const open = { status: { not: CLOSED } };

  const [outgoing, total, unassigned, overdue, byStatus, bySender, byCategory, fresh, deadlines] = await Promise.all([
    prisma.appeal.count({ where: { AND: [appealVisibilityWhere(actor), { direction: 'outgoing' }] } }),
    prisma.appeal.count({ where: scoped(actor) }),
    prisma.appeal.count({ where: scoped(actor, { assignee_id: null, ...open }) }),
    prisma.appeal.count({
      where: scoped(actor, { reply_deadline: { lt: todayDate }, ...open }),
    }),
    prisma.appeal.groupBy({ by: ['status'], where: scoped(actor), _count: { _all: true } }),
    prisma.appeal.groupBy({ by: ['sender_type'], where: scoped(actor), _count: { _all: true } }),
    prisma.appeal.groupBy({ by: ['category'], where: scoped(actor), _count: { _all: true } }),
    prisma.appeal.findMany({
      where: scoped(actor, { status: 'Новое' }),
      orderBy: [{ appeal_date: 'desc' }, { id: 'desc' }],
      take: 10,
      select: appealCard,
    }),
    prisma.appeal.findMany({
      where: scoped(actor, {
        ...open,
        reply_deadline: { not: null, lte: horizonDate },
      }),
      orderBy: [{ reply_deadline: 'asc' }, { id: 'asc' }],
      take: 15,
      select: appealCard,
    }),
  ]);

  const statusCounts = new Map(byStatus.map((row) => [row.status, row._count._all]));
  const known = new Set<string>(APPEAL_STATUSES);
  const extra = byStatus
    .filter((row) => !known.has(row.status))
    .map((row) => ({ status: row.status, count: row._count._all }));

  return {
    total,
    outgoing,
    unassigned,
    overdue,
    by_status: [
      ...APPEAL_STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
      ...extra,
    ],
    by_sender_type: bySender
      .map((row) => ({ name: label(row.sender_type), count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    by_category: byCategory
      .map((row) => ({ name: label(row.category), count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    fresh: fresh.map((row) => toItem(row, today)),
    deadlines: deadlines.map((row) => toItem(row, today)),
  };
}

const appealCard = {
  id: true,
  incoming_number: true,
  appeal_date: true,
  sender: true,
  sender_type: true,
  category: true,
  status: true,
  reply_deadline: true,
  assignee: { select: { full_name: true } },
} as const;

function toItem(
  row: {
    id: number;
    incoming_number: string;
    appeal_date: Date;
    sender: string;
    sender_type: string;
    category: string;
    status: string;
    reply_deadline: Date | null;
    assignee: { full_name: string } | null;
  },
  today: string,
) {
  const reply_deadline = row.reply_deadline ? formatDateOnly(row.reply_deadline) : null;
  return {
    id: row.id,
    incoming_number: row.incoming_number,
    appeal_date: formatDateOnly(row.appeal_date),
    sender: row.sender,
    sender_type: row.sender_type,
    category: row.category,
    status: row.status,
    reply_deadline,
    assignee: row.assignee?.full_name ?? '',
    overdue: Boolean(reply_deadline && reply_deadline < today && row.status !== CLOSED),
  };
}
