import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import type { UpdateCategoryInput } from '../schemas/category.js';

// Возвращает каноническое название. Пустая строка очищает категорию.
// Новое название попадает в справочник, отключённое повторно не включается.
export async function canonicalCategory(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (trimmed.length > 200) throw new AppError(400, 'Слишком длинное название категории');

  const existing = await prisma.category.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) return existing.name;

  try {
    const created = await prisma.category.create({ data: { name: trimmed } });
    return created.name;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const again = await prisma.category.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' } },
      });
      if (again) return again.name;
    }
    throw e;
  }
}

export async function listCategories() {
  const [categories, grouped] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.appeal.groupBy({ by: ['category'], _count: { _all: true } }),
  ]);
  const counts = new Map(grouped.map((row) => [row.category, row._count._all]));
  return categories.map((category) => ({
    ...category,
    appeals_count: counts.get(category.name) ?? 0,
  }));
}

export async function createCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, 'Укажите название');
  const dup = await prisma.category.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (dup) throw new AppError(409, 'Такая категория уже есть');
  return prisma.category.create({ data: { name: trimmed } });
}

export async function updateCategory(id: number, data: UpdateCategoryInput) {
  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) throw new AppError(404, 'Категория не найдена');

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (trimmed.toLowerCase() !== current.name.toLowerCase()) {
      const dup = await prisma.category.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' }, NOT: { id } },
      });
      if (dup) throw new AppError(409, 'Такая категория уже есть');
    }
    await prisma.$transaction([
      prisma.category.update({
        where: { id },
        data: {
          name: trimmed,
          ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        },
      }),
      prisma.appeal.updateMany({ where: { category: current.name }, data: { category: trimmed } }),
    ]);
  } else if (data.is_active !== undefined) {
    await prisma.category.update({ where: { id }, data: { is_active: data.is_active } });
  }

  return prisma.category.findUnique({ where: { id } });
}

export async function deleteCategory(id: number) {
  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) throw new AppError(404, 'Категория не найдена');
  const used = await prisma.appeal.count({ where: { category: current.name } });
  if (used > 0) {
    throw new AppError(409, 'Категория используется в обращениях. Её можно отключить.');
  }
  await prisma.category.delete({ where: { id } });
}
