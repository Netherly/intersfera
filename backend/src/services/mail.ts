import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export interface MailMessage {
  uid: number;
  uid_validity: string;
  from: string;
  email: string;
  subject: string;
  date: string | null;
  text: string;
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
      messages.push({
        uid,
        uid_validity: uidValidity,
        from,
        email,
        subject,
        date: parsed.date ? parsed.date.toISOString() : null,
        text: (parsed.text ?? '').slice(0, 20_000),
      });
    }

    return { configured: true, messages };
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
