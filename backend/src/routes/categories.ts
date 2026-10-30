import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
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
    res.json(await updateCategory(id, data));
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
    await deleteCategory(id);
    res.json({ ok: true });
  }),
);

export default router;
