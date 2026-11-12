// Приводит переменные Neon и Vercel к тем именам, которые ждёт Prisma.
// Та же логика продублирована в scripts/vercel-build.mjs — её видит CLI до запуска приложения.

function withParam(url: string, key: string, value: string): string {
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${value}`;
}

function withNeonSsl(url: string): string {
  if (!url.includes('.neon.tech')) return url;
  return withParam(url, 'sslmode', 'require');
}

export function prepareDatabaseEnv(): void {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || '';
  }

  const original = process.env.DATABASE_URL;
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL =
      process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || original;
  }
  if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = withNeonSsl(process.env.DIRECT_URL);
  }

  if (!original) return;

  let pooled = withNeonSsl(original);
  if (pooled.includes('-pooler.')) {
    pooled = withParam(pooled, 'pgbouncer', 'true');
    pooled = withParam(pooled, 'connection_limit', '1');
  }
  process.env.DATABASE_URL = pooled;
}
