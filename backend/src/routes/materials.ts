import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { createMaterialSchema, listMaterialsSchema, updateMaterialSchema } from '../schemas/material.js';
import { createMaterial, deleteMaterial, listMaterials, updateMaterial } from '../services/materials.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requirePermission('materials.view'),
  asyncHandler(async (req, res) => {
    const query = listMaterialsSchema.parse({
      kind: typeof req.query.kind === 'string' && req.query.kind !== '' ? req.query.kind : undefined,
    });
    res.json(await listMaterials(query.kind));
  }),
);

router.post(
  '/',
  requirePermission('materials.edit'),
  asyncHandler(async (req, res) => {
    const data = createMaterialSchema.parse(req.body);
    res.status(201).json(await createMaterial(data));
  }),
);

router.patch(
  '/:id',
  requirePermission('materials.edit'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const data = updateMaterialSchema.parse(req.body);
    res.json(await updateMaterial(id, data));
  }),
);

router.delete(
  '/:id',
  requirePermission('materials.edit'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    await deleteMaterial(id);
    res.json({ ok: true });
  }),
);

export default router;
