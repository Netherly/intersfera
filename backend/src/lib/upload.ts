import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';

export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.tif',
  '.tiff',
  '.gif',
]);

export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

try {
  fs.mkdirSync(env.uploadDir, { recursive: true });
} catch (e) {
  console.error('Не удалось создать каталог загрузок:', e);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + (ALLOWED_EXTENSIONS.has(ext) ? ext : ''));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error('Допустимы PDF и изображения'));
      return;
    }
    cb(null, true);
  },
});

export function uploadErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err && 'code' in err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    return 'Файл больше 30 МБ';
  }
  if (err instanceof Error && err.message === 'Допустимы PDF и изображения') return err.message;
  return 'Ошибка загрузки файла';
}

// Имя на диске — только uuid. Чужой путь не отдаём.
export function storedFilePath(storedName: string): string {
  if (!storedName || storedName !== path.basename(storedName)) {
    throw new Error('Некорректное имя файла');
  }
  const root = path.resolve(env.uploadDir);
  const full = path.resolve(root, storedName);
  if (!full.startsWith(root + path.sep)) {
    throw new Error('Некорректное имя файла');
  }
  return full;
}
