import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import type { UpdateAddresseeInput } from '../schemas/addressee.js';

async function findByName(name: string) {
  return prisma.addressee.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
}

// Имя в письме не создаёт запись в справочнике. Если такое имя уже есть, берём его написание.
export async function resolveAddresseeName(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 200) return trimmed;
  const existing = await findByName(trimmed);
  return existing?.name ?? trimmed;
}

export async function saveAddressee(name: string, email: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, 'Укажите название');
  if (trimmed.length > 200) throw new AppError(400, 'Слишком длинное имя адресата');

  const existing = await findByName(trimmed);
  if (existing) {
    if (existing.email === email) return { row: existing, result: 'unchanged' as const };
    const row = await prisma.addressee.update({ where: { id: existing.id }, data: { email } });
    return { row, result: 'updated' as const };
  }

  try {
    const row = await prisma.addressee.create({ data: { name: trimmed, email } });
    return { row, result: 'created' as const };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const again = await findByName(trimmed);
      if (again) {
        if (again.email === email) return { row: again, result: 'unchanged' as const };
        const row = await prisma.addressee.update({ where: { id: again.id }, data: { email } });
        return { row, result: 'updated' as const };
      }
    }
    throw e;
  }
}

export async function listAddressees() {
  const [rows, grouped] = await Promise.all([
    prisma.addressee.findMany({ orderBy: { name: 'asc' } }),
    prisma.appeal.groupBy({
      by: ['sender'],
      where: { direction: 'outgoing' },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map(grouped.map((row) => [row.sender, row._count._all]));
  return rows.map((row) => ({
    ...row,
    letters_count: counts.get(row.name) ?? 0,
  }));
}

export async function updateAddressee(id: number, data: UpdateAddresseeInput) {
  const current = await prisma.addressee.findUnique({ where: { id } });
  if (!current) throw new AppError(404, 'Адресат не найден');

  let nextName = current.name;
  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (trimmed.toLowerCase() !== current.name.toLowerCase()) {
      const dup = await prisma.addressee.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' }, NOT: { id } },
      });
      if (dup) throw new AppError(409, 'Такой адресат уже есть');
    }
    nextName = trimmed;
  }

  await prisma.$transaction([
    prisma.addressee.update({
      where: { id },
      data: {
        name: nextName,
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
      },
    }),
    ...(nextName !== current.name
      ? [
          prisma.appeal.updateMany({
            where: { direction: 'outgoing', sender: current.name },
            data: { sender: nextName },
          }),
        ]
      : []),
  ]);

  return prisma.addressee.findUnique({ where: { id } });
}

export async function deleteAddressee(id: number) {
  const current = await prisma.addressee.findUnique({ where: { id } });
  if (!current) throw new AppError(404, 'Адресат не найден');
  const used = await prisma.appeal.count({ where: { direction: 'outgoing', sender: current.name } });
  if (used > 0) throw new AppError(409, 'Адресат указан в письмах. Его можно отключить.');
  await prisma.addressee.delete({ where: { id } });
}
