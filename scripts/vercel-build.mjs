import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function withParam(url, key, value) {
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${value}`;
}

function withNeonSsl(url) {
  if (!url.includes('.neon.tech')) return url;
  return withParam(url, 'sslmode', 'require');
}

// Держать в соответствии с backend/src/config/databaseEnv.ts.
function prepareDatabaseEnv() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || '';
  }

  const original = process.env.DATABASE_URL || '';
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

prepareDatabaseEnv();

if (!process.env.DATABASE_URL) {
  console.error(
    'Нет DATABASE_URL. Подключите Neon в проекте Vercel или вставьте pooled-строку вручную.',
  );
  process.exit(1);
}

const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const env = process.env;

execSync('npx prisma generate', { cwd: backend, stdio: 'inherit', env });
execSync('npx prisma migrate deploy', { cwd: backend, stdio: 'inherit', env });
execSync('npx tsx prisma/seed.ts', { cwd: backend, stdio: 'inherit', env });
execSync('npm run build', { cwd: frontend, stdio: 'inherit', env });
