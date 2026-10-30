import 'dotenv/config';
import path from 'node:path';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Не задана переменная окружения: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgresql://crm:crm@localhost:5433/intersfera'),
  jwtSecret: required('JWT_SECRET', 'dev-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins:
    process.env.CORS_ORIGIN === '*'
      ? '*'
      : (process.env.CORS_ORIGIN ?? 'http://localhost:5174')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
  // На Vercel записан только /tmp, и он не переживает следующий вызов.
  uploadDir: process.env.VERCEL
    ? '/tmp/uploads'
    : path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') !== 'false',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? '',
  },
  imap: {
    host: process.env.IMAP_HOST ?? '',
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: (process.env.IMAP_SECURE ?? 'true') !== 'false',
    user: process.env.IMAP_USER ?? '',
    password: process.env.IMAP_PASSWORD ?? '',
    folder: process.env.IMAP_FOLDER ?? 'INBOX',
    subject: process.env.IMAP_SUBJECT ?? '',
  },
};
