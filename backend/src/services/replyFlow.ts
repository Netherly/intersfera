import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { formatDateOnly, formatRuDate, parseDateOnly, todayMoscow } from '../lib/dates.js';
import { storedFilePath } from '../lib/upload.js';
import { normText } from '../lib/text.js';
import { type AppealActor, canSeeAppeal } from '../lib/appealAccess.js';
import { getAppeal } from './appeals.js';
import { renderLetterPdf } from './letterPdf.js';
import { sendAttachment } from './mail.js';

type CheckedAppeal = {
  final_reply: string;
  reply_checked_text: string;
  reply_checked_at: Date | null;
};

export function assertChecked(appeal: CheckedAppeal) {
  if (!appeal.reply_checked_at || normText(appeal.final_reply) !== normText(appeal.reply_checked_text)) {
    throw new AppError(400, 'Сначала отметьте финальный текст как проверенный');
  }
}

async function loadVisible(id: number, actor: AppealActor) {
  const appeal = await prisma.appeal.findUnique({
    where: { id },
    include: { files: { orderBy: { created_at: 'desc' as const } } },
  });
  if (!appeal || !canSeeAppeal(appeal.assignee_id, actor)) {
    throw new AppError(404, 'Обращение не найдено');
  }
  return appeal;
}

export async function checkReply(id: number, text: string, actor: AppealActor) {
  const appeal = await loadVisible(id, actor);
  const next = normText(text);
  if (!next.trim()) throw new AppError(400, 'Финальный текст пустой');
  const already =
    appeal.reply_checked_at &&
    normText(appeal.reply_checked_text) === next &&
    normText(appeal.final_reply) === next;
  if (!already) {
    await prisma.$transaction(async (tx) => {
      await tx.appeal.update({
        where: { id },
        data: {
          final_reply: next,
          reply_checked_text: next,
          reply_checked_at: new Date(),
          reply_checked_by_id: actor.id,
        },
      });
      await tx.appealEvent.create({
        data: {
          appeal_id: id,
          user_id: actor.id,
          action: 'reply_checked',
          payload: {},
        },
      });
    });
  }
  return getAppeal(id, actor);
}

function pdfFileName(outgoingNumber: string): string {
  const clean = outgoingNumber.replace(/[<>:"/\\|?*]/g, '_').trim() || 'ответ';
  return `Исх ${clean}.pdf`;
}

export async function generateReplyPdf(id: number, actor: AppealActor) {
  const appeal = await loadVisible(id, actor);
  assertChecked(appeal);
  if (!appeal.outgoing_number.trim()) throw new AppError(400, 'Укажите исходящий номер');

  const today = todayMoscow();
  const outgoingIso = appeal.outgoing_date ? formatDateOnly(appeal.outgoing_date) : today;
  const buffer = await renderLetterPdf({
    sender: appeal.sender,
    objectAddress: appeal.object_address,
    replyEmail: appeal.reply_email,
    outgoingNumber: appeal.outgoing_number.trim(),
    outgoingDate: formatRuDate(outgoingIso),
    correspondentNumber: appeal.correspondent_number.trim(),
    correspondentDate: appeal.correspondent_date ? formatRuDate(formatDateOnly(appeal.correspondent_date)) : '',
    body: appeal.final_reply,
  });

  const storedName = `${randomUUID()}.pdf`;
  const fullPath = storedFilePath(storedName);
  await writeFile(fullPath, buffer);
  const originalName = pdfFileName(appeal.outgoing_number);

  try {
    await prisma.$transaction(async (tx) => {
      if (!appeal.outgoing_date) {
        await tx.appeal.update({
          where: { id },
          data: { outgoing_date: parseDateOnly(today) },
        });
      }
      const saved = await tx.appealFile.create({
        data: {
          appeal_id: id,
          kind: 'generated_pdf',
          original_name: originalName,
          stored_name: storedName,
          mime: 'application/pdf',
          size: buffer.length,
          uploaded_by_id: actor.id,
        },
      });
      await tx.appealEvent.create({
        data: {
          appeal_id: id,
          user_id: actor.id,
          action: 'pdf_generated',
          payload: { file_id: saved.id, name: originalName },
        },
      });
    });
  } catch (err) {
    await unlink(fullPath).catch(() => undefined);
    throw err;
  }

  return getAppeal(id, actor);
}

function assertEmail(value: string): string {
  const email = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'Укажите адрес получателя');
  }
  return email;
}

export async function sendReplyFile(
  id: number,
  kind: 'generated_pdf' | 'signed_scan',
  email: string,
  actor: AppealActor,
) {
  const appeal = await loadVisible(id, actor);
  const to = assertEmail(email);
  const file = appeal.files.find((item) => item.kind === kind);
  if (!file) {
    throw new AppError(400, kind === 'generated_pdf' ? 'Сначала сформируйте PDF' : 'Сначала загрузите подписанный скан');
  }
  if (kind === 'generated_pdf') {
    assertChecked(appeal);
    if (!appeal.reply_checked_at || file.created_at.getTime() + 1000 < appeal.reply_checked_at.getTime()) {
      throw new AppError(400, 'Сформируйте PDF заново: проверка новее файла');
    }
  }

  const fullPath = storedFilePath(file.stored_name);
  let content: Buffer;
  try {
    content = await readFile(fullPath);
  } catch {
    throw new AppError(404, 'Файл не найден на диске');
  }

  const outgoing = appeal.direction === 'outgoing';
  const number = appeal.outgoing_number.trim();
  const topic = outgoing ? appeal.summary.trim().split('\n')[0].slice(0, 150) : '';
  const subject = number
    ? `Исх. ${number}${topic ? ` — ${topic}` : ''}`
    : `Ответ на обращение ${appeal.incoming_number}`;
  await sendAttachment({
    to,
    subject,
    text: outgoing ? 'Направляем письмо во вложении.' : 'Направляем ответ во вложении.',
    filename: file.original_name,
    content,
    contentType: file.mime || 'application/octet-stream',
  });

  await prisma.appealEvent.create({
    data: {
      appeal_id: id,
      user_id: actor.id,
      action: 'email_sent',
      payload: {
        to,
        kind,
        file_id: file.id,
        name: file.original_name,
      } as Prisma.InputJsonValue,
    },
  });

  return getAppeal(id, actor);
}
