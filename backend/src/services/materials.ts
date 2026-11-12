import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import type { CreateMaterialInput, UpdateMaterialInput } from '../schemas/material.js';

export async function listMaterials(kind?: string) {
  return prisma.material.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ title: 'asc' }],
  });
}

export async function createMaterial(input: CreateMaterialInput) {
  try {
    return await prisma.material.create({
      data: {
        kind: input.kind,
        title: input.title,
        citation: input.citation?.trim() ?? '',
        body: input.body ?? '',
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(409, 'Такая запись уже есть в этой базе');
    }
    throw e;
  }
}

export async function updateMaterial(id: number, input: UpdateMaterialInput) {
  const current = await prisma.material.findUnique({ where: { id } });
  if (!current) throw new AppError(404, 'Запись не найдена');
  try {
    return await prisma.material.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.citation !== undefined ? { citation: input.citation.trim() } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(409, 'Такая запись уже есть в этой базе');
    }
    throw e;
  }
}

export async function deleteMaterial(id: number) {
  const current = await prisma.material.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw new AppError(404, 'Запись не найдена');
  await prisma.material.delete({ where: { id } });
}
