import { access, unlink } from 'node:fs/promises';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { formatDateOnly, parseDateOnly } from '../lib/dates.js';
import { normText } from '../lib/text.js';
import { markMailSeen } from './mail.js';
import { diffAppeal, splitChanges, type AppealSnapshot } from '../lib/appealDiff.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { storedFilePath } from '../lib/upload.js';
import { APPEAL_STATUSES, SENDER_TYPES, type CreateAppealInput, type FileKind, type ListAppealsInput, type UpdateAppealInput } from '../schemas/appeal.js';
import { type AppealActor, canSeeAppeal, appealVisibilityWhere } from '../lib/appealAccess.js';
import { resolveAddresseeName } from './addressees.js';
import { canonicalCategory } from './categories.js';

const userShort = { select: { id: true, full_name: true } } as const;

const detailInclude = {
  assignee: userShort,
  created_by: userShort,
  reply_checked_by: userShort,
  files: {
    orderBy: { created_at: 'desc' as const },
    include: { uploaded_by: userShort },
  },
  events: {
    orderBy: { created_at: 'desc' as const },
    take: 200,
    include: { user: userShort },
  },
};

type AppealRow = {
  incoming_number: string;
  appeal_date: Date;
  sender: string;
  sender_type: string;
  object_address: string;
  correspondent_number: string;
  correspondent_date: Date | null;
  reply_deadline: Date | null;
  reply_email: string;
  outgoing_number: string;
  outgoing_date: Date | null;
  category: string;
  recognized_text: string;
  summary: string;
  draft_reply: string;
  final_reply: string;
  status: string;
  assignee_id: number | null;
};

function dateOrNull(value: Date | null): string | null {
  return value ? formatDateOnly(value) : null;
}

function toSnapshot(row: AppealRow): AppealSnapshot {
  return {
    incoming_number: row.incoming_number,
    appeal_date: formatDateOnly(row.appeal_date),
    sender: row.sender,
    sender_type: row.sender_type,
    object_address: row.object_address,
    correspondent_number: row.correspondent_number,
    correspondent_date: dateOrNull(row.correspondent_date),
    reply_deadline: dateOrNull(row.reply_deadline),
    reply_email: row.reply_email,
    outgoing_number: row.outgoing_number,
    outgoing_date: dateOrNull(row.outgoing_date),
    category: row.category,
    recognized_text: row.recognized_text,
    summary: row.summary,
    draft_reply: row.draft_reply,
    final_reply: row.final_reply,
    status: row.status,
    assignee_id: row.assignee_id,
  };
}

function serialize<T extends { appeal_date: Date }>(appeal: T) {
  const row = appeal as T & {
    correspondent_date?: Date | null;
    reply_deadline?: Date | null;
    outgoing_date?: Date | null;
    reply_checked_at?: Date | null;
  };
  return {
    ...appeal,
    appeal_date: formatDateOnly(appeal.appeal_date),
    ...('correspondent_date' in row ? { correspondent_date: dateOrNull(row.correspondent_date ?? null) } : {}),
    ...('reply_deadline' in row ? { reply_deadline: dateOrNull(row.reply_deadline ?? null) } : {}),
    ...('outgoing_date' in row ? { outgoing_date: dateOrNull(row.outgoing_date ?? null) } : {}),
    ...('reply_checked_at' in row
      ? { reply_checked_at: row.reply_checked_at ? row.reply_checked_at.toISOString() : null }
      : {}),
  };
}

function assignDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseDateOnly(value);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function assertIncomingNumberAvailable(number: string, exceptId?: number) {
  const existing = await prisma.appeal.findFirst({
    where: {
      incoming_number: { equals: number, mode: 'insensitive' },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new AppError(409, 'Запись с таким номером уже есть');
}

async function assertActiveUser(id: number) {
  const user = await prisma.user.findFirst({
    where: { id, is_active: true },
    select: { id: true },
  });
  if (!user) throw new AppError(400, 'Сотрудник не найден или заблокирован');
}

function rethrowNumberConflict(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new AppError(409, 'Запись с таким номером уже есть');
  }
  throw e;
}

export async function listLookups() {
  const [categories, users] = await Promise.all([
    prisma.category.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { is_active: true },
      select: { id: true, full_name: true },
      orderBy: { full_name: 'asc' },
    }),
  ]);
  return { statuses: APPEAL_STATUSES, sender_types: SENDER_TYPES, categories, users };
}

export async function listAppeals(query: ListAppealsInput, actor: AppealActor) {
  const page = parsePagination(query);
  const filters: Prisma.AppealWhereInput[] = [appealVisibilityWhere(actor)];
  if (query.q) {
    filters.push({
      OR: [
        { incoming_number: { contains: query.q, mode: 'insensitive' } },
        { sender: { contains: query.q, mode: 'insensitive' } },
        { object_address: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }
  if (query.status) filters.push({ status: query.status });
  if (query.category) filters.push({ category: query.category });
  if (query.sender_type) filters.push({ sender_type: query.sender_type });
  if (query.unassigned) filters.push({ assignee_id: null });
  else if (query.assignee_id) filters.push({ assignee_id: query.assignee_id });
  if (query.direction) filters.push({ direction: query.direction });
  const where: Prisma.AppealWhereInput = { AND: filters };

  const [items, total] = await Promise.all([
    prisma.appeal.findMany({
      where,
      orderBy: [{ appeal_date: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        incoming_number: true,
        appeal_date: true,
        sender: true,
        sender_type: true,
        object_address: true,
        reply_deadline: true,
        category: true,
        status: true,
        direction: true,
        assignee_id: true,
        assignee: userShort,
      },
    }),
    prisma.appeal.count({ where }),
  ]);

  return paginated(items.map(serialize), total, page);
}

export async function getAppeal(id: number, actor?: AppealActor) {
  const appeal = await prisma.appeal.findUnique({ where: { id }, include: detailInclude });
  if (!appeal || (actor && !canSeeAppeal(appeal.assignee_id, actor))) {
    throw new AppError(404, 'Обращение не найдено');
  }
  return serialize(appeal);
}

export async function createAppeal(input: CreateAppealInput, userId: number) {
  await assertIncomingNumberAvailable(input.incoming_number);
  const direction = input.direction ?? 'incoming';
  const category = await canonicalCategory(input.category ?? '');
  if (input.assignee_id) await assertActiveUser(input.assignee_id);
  const appealDate = parseDateOnly(input.appeal_date ?? todayUtc());
  const rawSender = input.sender?.trim() ?? '';
  const sender = direction === 'outgoing' ? await resolveAddresseeName(rawSender) : rawSender;

  let createdId: number;
  try {
    const created = await prisma.appeal.create({
      data: {
        incoming_number: input.incoming_number,
        appeal_date: appealDate,
        sender,
        sender_type: input.sender_type ?? '',
        object_address: input.object_address?.trim() ?? '',
        category,
        summary: input.summary ?? '',
        recognized_text: input.recognized_text ?? '',
        reply_email: input.reply_email?.trim() ?? '',
        final_reply: direction === 'outgoing' ? input.final_reply ?? '' : '',
        outgoing_number: direction === 'outgoing' ? input.incoming_number : '',
        outgoing_date: direction === 'outgoing' ? appealDate : null,
        direction,
        status: 'Новое',
        assignee_id: input.assignee_id ?? null,
        created_by_id: userId,
        events: {
          create: {
            user_id: userId,
            action: 'created',
            payload: {
              incoming_number: input.incoming_number,
              appeal_date: formatDateOnly(appealDate),
              sender,
              category,
            },
          },
        },
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (e) {
    rethrowNumberConflict(e);
  }

  if (input.mail_uid && input.mail_uid_validity) {
    await markMailSeen(input.mail_uid, input.mail_uid_validity).catch((err) => {
      console.error('Не удалось отметить письмо прочитанным', err);
    });
  }

  return getAppeal(createdId);
}

export async function updateAppeal(id: number, input: UpdateAppealInput, actor: AppealActor) {
  const before = await prisma.appeal.findUnique({
    where: { id },
    include: { assignee: userShort },
  });
  if (!before || !canSeeAppeal(before.assignee_id, actor)) {
    throw new AppError(404, 'Обращение не найдено');
  }

  const data: Prisma.AppealUncheckedUpdateInput = {};
  if (input.incoming_number !== undefined && input.incoming_number !== before.incoming_number) {
    await assertIncomingNumberAvailable(input.incoming_number, id);
    data.incoming_number = input.incoming_number;
    if (before.direction === 'outgoing') data.outgoing_number = input.incoming_number;
  }
  if (input.appeal_date !== undefined) {
    data.appeal_date = parseDateOnly(input.appeal_date);
    if (before.direction === 'outgoing') data.outgoing_date = parseDateOnly(input.appeal_date);
  }
  if (input.sender !== undefined) {
    const trimmed = input.sender.trim();
    data.sender = before.direction === 'outgoing' ? await resolveAddresseeName(trimmed) : trimmed;
  }
  if (input.sender_type !== undefined) data.sender_type = input.sender_type;
  if (input.object_address !== undefined) data.object_address = input.object_address.trim();
  if (input.correspondent_number !== undefined) data.correspondent_number = input.correspondent_number.trim();
  if (input.correspondent_date !== undefined) data.correspondent_date = assignDate(input.correspondent_date);
  if (input.reply_deadline !== undefined) data.reply_deadline = assignDate(input.reply_deadline);
  if (input.reply_email !== undefined) data.reply_email = input.reply_email.trim();
  if (input.outgoing_number !== undefined) data.outgoing_number = input.outgoing_number.trim();
  if (input.outgoing_date !== undefined) data.outgoing_date = assignDate(input.outgoing_date);
  if (input.category !== undefined) data.category = await canonicalCategory(input.category);
  if (input.recognized_text !== undefined) data.recognized_text = input.recognized_text;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.draft_reply !== undefined) data.draft_reply = input.draft_reply;
  let clearCheck = false;
  if (input.final_reply !== undefined) {
    data.final_reply = input.final_reply;
    if (before.reply_checked_at && normText(input.final_reply) !== normText(before.reply_checked_text)) {
      data.reply_checked_text = '';
      data.reply_checked_at = null;
      data.reply_checked_by_id = null;
      clearCheck = true;
    }
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.assignee_id !== undefined) {
    if (input.assignee_id !== null) await assertActiveUser(input.assignee_id);
    data.assignee_id = input.assignee_id;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.appeal.update({
        where: { id },
        data,
        include: { assignee: userShort },
      });
      const changes = diffAppeal(toSnapshot(before), toSnapshot(updated));
      const { status, assignee, rest } = splitChanges(changes);
      if (status) {
        await tx.appealEvent.create({
          data: {
            appeal_id: id,
            user_id: actor.id,
            action: 'status_changed',
            payload: { from: status.from, to: status.to },
          },
        });
      }
      if (assignee) {
        await tx.appealEvent.create({
          data: {
            appeal_id: id,
            user_id: actor.id,
            action: 'assigned',
            payload: {
              from_id: assignee.from,
              from_name: before.assignee?.full_name ?? null,
              to_id: assignee.to,
              to_name: updated.assignee?.full_name ?? null,
            },
          },
        });
      }
      if (Object.keys(rest).length > 0) {
        await tx.appealEvent.create({
          data: {
            appeal_id: id,
            user_id: actor.id,
            action: 'updated',
            payload: { changes: rest as Prisma.InputJsonValue },
          },
        });
      }
      if (clearCheck) {
        await tx.appealEvent.create({
          data: {
            appeal_id: id,
            user_id: actor.id,
            action: 'reply_unchecked',
            payload: {},
          },
        });
      }
    });
  } catch (e) {
    rethrowNumberConflict(e);
  }

  return getAppeal(id);
}

export async function deleteAppeal(id: number) {
  const existing = await prisma.appeal.findUnique({
    where: { id },
    include: { files: { select: { stored_name: true } } },
  });
  if (!existing) throw new AppError(404, 'Обращение не найдено');
  await prisma.appeal.delete({ where: { id } });
  await Promise.all(
    existing.files.map((file) => unlink(storedFilePath(file.stored_name)).catch(() => undefined)),
  );
}

async function assertVisibleAppeal(id: number, actor: AppealActor) {
  const appeal = await prisma.appeal.findUnique({ where: { id }, select: { assignee_id: true } });
  if (!appeal || !canSeeAppeal(appeal.assignee_id, actor)) {
    throw new AppError(404, 'Обращение не найдено');
  }
}

export async function addAppealFile(
  appealId: number,
  actor: AppealActor,
  file: { kind: FileKind; storedName: string; originalName: string; mime: string; size: number },
) {
  try {
    await assertVisibleAppeal(appealId, actor);
  } catch (e) {
    await unlink(storedFilePath(file.storedName)).catch(() => undefined);
    throw e;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const saved = await tx.appealFile.create({
        data: {
          appeal_id: appealId,
          kind: file.kind,
          original_name: file.originalName,
          stored_name: file.storedName,
          mime: file.mime || 'application/octet-stream',
          size: file.size,
          uploaded_by_id: actor.id,
        },
      });
      await tx.appealEvent.create({
        data: {
          appeal_id: appealId,
          user_id: actor.id,
          action: 'file_uploaded',
          payload: { file_id: saved.id, kind: file.kind, name: file.originalName },
        },
      });
    });
  } catch (e) {
    await unlink(storedFilePath(file.storedName)).catch(() => undefined);
    throw e;
  }

  return getAppeal(appealId);
}

export async function deleteAppealFile(appealId: number, fileId: number, actor: AppealActor) {
  await assertVisibleAppeal(appealId, actor);
  const file = await prisma.appealFile.findFirst({ where: { id: fileId, appeal_id: appealId } });
  if (!file) throw new AppError(404, 'Файл не найден');

  await prisma.$transaction(async (tx) => {
    await tx.appealEvent.create({
      data: {
        appeal_id: appealId,
        user_id: actor.id,
        action: 'file_deleted',
        payload: { file_id: file.id, kind: file.kind, name: file.original_name },
      },
    });
    await tx.appealFile.delete({ where: { id: file.id } });
  });

  await unlink(storedFilePath(file.stored_name)).catch(() => undefined);
  return getAppeal(appealId);
}

export async function getAppealFile(appealId: number, fileId: number, actor: AppealActor) {
  await assertVisibleAppeal(appealId, actor);
  const file = await prisma.appealFile.findFirst({ where: { id: fileId, appeal_id: appealId } });
  if (!file) throw new AppError(404, 'Файл не найден');
  const fullPath = storedFilePath(file.stored_name);
  try {
    await access(fullPath);
  } catch {
    throw new AppError(404, 'Файл не найден на диске');
  }
  return { file, fullPath };
}
