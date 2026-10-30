import path from 'node:path';

// Multer отдаёт UTF-8 имена как latin1. Возвращаем безопасное имя без пути.
export function safeOriginalName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'file';
  const decoded = Buffer.from(trimmed, 'latin1').toString('utf8');
  const value = decoded.includes('\uFFFD') ? trimmed : decoded;
  const base = path.basename(value).replace(/[<>:"|?*]/g, '_').slice(0, 180).trim();
  return base || 'file';
}

export function contentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '') || 'file';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
