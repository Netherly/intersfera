import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export interface MailAttachment {
  index: number;
  filename: string;
  content_type: string;
  size: number;
}

export interface MailMessage {
  uid: number;
  uid_validity: string;
  from: string;
  email: string;
  subject: string;
  date: string | null;
  text: string;
  attachments: MailAttachment[];
}

const TEXT_LIMIT = 80_000;

function letterText(parsed: { text?: string; html?: string | false }): { text: string; truncated: boolean } {
  const plain = parsed.text?.trim()
    ? parsed.text
    : typeof parsed.html === 'string'
      ? parsed.html
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim()
      : '';
  return { text: plain.slice(0, TEXT_LIMIT), truncated: plain.length > TEXT_LIMIT };
}

function attachmentName(filename: string | undefined, index: number): string {
  const cleaned = (filename ?? '').replace(/[\r\n"]/g, '').trim().slice(0, 180);
  return cleaned || `вложение-${index + 1}`;
}

export function imapConfigured(): boolean {
  return Boolean(env.imap.host && env.imap.user && env.imap.password);
}

export function smtpConfigured(): boolean {
  return Boolean(env.smtp.host && env.smtp.from);
}

function mailError(err: unknown): AppError {
  const message = err instanceof Error ? err.message : 'неизвестная ошибка';
  return new AppError(502, `Не удалось подключиться к почте: ${message}`);
}

async function withMailbox<T>(fn: (client: ImapFlow, uidValidity: string) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: env.imap.host,
    port: env.imap.port,
    secure: env.imap.secure,
    auth: { user: env.imap.user, pass: env.imap.password },
    logger: false,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });
  let locked = false;
  try {
    await client.connect();
    const lock = await client.getMailboxLock(env.imap.folder || 'INBOX');
    locked = true;
    try {
      const box = client.mailbox;
      const uidValidity = box && typeof box === 'object' ? String(box.uidValidity) : '';
      return await fn(client, uidValidity);
    } finally {
      lock.release();
      locked = false;
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mailError(err);
  } finally {
    if (!locked) await client.logout().catch(() => undefined);
    else await client.logout().catch(() => undefined);
  }
}

export async function listInbox(): Promise<{ configured: boolean; messages: MailMessage[] }> {
  if (!imapConfigured()) return { configured: false, messages: [] };

  return withMailbox(async (client, uidValidity) => {
    const found = await client.search({ seen: false }, { uid: true });
    const uids = Array.isArray(found) ? found : [];
    const picked = [...uids].sort((a, b) => b - a).slice(0, 40);
    const subjectFilter = env.imap.subject.trim().toLowerCase();
    const messages: MailMessage[] = [];

    for (const uid of picked) {
      const message = await client.fetchOne(uid, { source: true, uid: true }, { uid: true });
      if (!message || !message.source) continue;
      const parsed = await simpleParser(message.source);
      const subject = parsed.subject?.trim() || '';
      if (subjectFilter && !subject.toLowerCase().includes(subjectFilter)) continue;
      const address = parsed.from?.value?.[0];
      const email = address?.address ?? '';
      const from = parsed.from?.text?.trim() || email;
      const body = letterText(parsed);
      messages.push({
        uid,
        uid_validity: uidValidity,
        from,
        email,
        subject,
        date: parsed.date ? parsed.date.toISOString() : null,
        text: body.text,
        attachments: (parsed.attachments ?? []).map((item, index) => ({
          index,
          filename: attachmentName(item.filename, index),
          content_type: item.contentType || 'application/octet-stream',
          size: item.size || item.content?.length || 0,
        })),
      });
    }

    return { configured: true, messages };
  });
}

export async function readMailAttachment(
  uid: number,
  uidValidity: string,
  index: number,
): Promise<{ filename: string; contentType: string; content: Buffer }> {
  if (!imapConfigured()) throw new AppError(400, 'Почта не настроена');
  return withMailbox(async (client, current) => {
    if (uidValidity && current && uidValidity !== current) {
      throw new AppError(409, 'Папка почты изменилась. Обновите список и повторите.');
    }
    const message = await client.fetchOne(uid, { source: true, uid: true }, { uid: true });
    if (!message || !message.source) throw new AppError(404, 'Письмо не найдено');
    const parsed = await simpleParser(message.source);
    const item = parsed.attachments?.[index];
    if (!item?.content) throw new AppError(404, 'Вложение не найдено');
    return {
      filename: attachmentName(item.filename, index),
      contentType: item.contentType || 'application/octet-stream',
      content: item.content,
    };
  });
}

export async function markMailSeen(uid: number, uidValidity: string): Promise<void> {
  if (!imapConfigured()) throw new AppError(400, 'Почта не настроена');
  await withMailbox(async (client, current) => {
    if (uidValidity && current && uidValidity !== current) {
      throw new AppError(409, 'Папка почты изменилась. Обновите список и повторите.');
    }
    await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
  });
}

export async function sendAttachment(input: {
  to: string;
  subject: string;
  text: string;
  filename: string;
  content: Buffer;
  contentType: string;
}): Promise<void> {
  if (!smtpConfigured()) {
    throw new AppError(400, 'Почта для отправки не настроена. Укажите SMTP в настройках сервера.');
  }
  const transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
  });
  try {
    await transport.sendMail({
      from: env.smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      attachments: [
        {
          filename: input.filename,
          content: input.content,
          contentType: input.contentType || 'application/octet-stream',
        },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'неизвестная ошибка';
    throw new AppError(502, `Не удалось отправить письмо: ${message}`);
  }
}
