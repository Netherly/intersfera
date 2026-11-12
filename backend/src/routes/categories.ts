import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { changedKeys, logAudit } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { createCategorySchema, updateCategorySchema } from '../schemas/category.js';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/categories.js';

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listCategories());
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createCategorySchema.parse(req.body);
    const category = await createCategory(data.name);
    await logAudit({ userId: req.user!.id, entity: 'category', entityId: category.id, action: 'created', title: category.name });
    res.status(201).json(category);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const data = updateCategorySchema.parse(req.body);
    const before = await prisma.category.findUnique({ where: { id } });
    const updated = await updateCategory(id, data);
    const fields = before ? changedKeys(before, data) : [];
    if (updated && fields.length > 0) {
      await logAudit({
        userId: req.user!.id,
        entity: 'category',
        entityId: id,
        action: 'updated',
        title: updated.name,
        payload: { fields, from: before?.name },
      });
    }
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const before = await prisma.category.findUnique({ where: { id } });
    await deleteCategory(id);
    await logAudit({ userId: req.user!.id, entity: 'category', entityId: id, action: 'deleted', title: before?.name ?? '' });
    res.json({ ok: true });
  }),
);

export default router;
