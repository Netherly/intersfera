import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { changedKeys, logAudit } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireDepartment, requirePermission } from '../middleware/auth.js';
import { createMaterialSchema, listMaterialsSchema, updateMaterialSchema } from '../schemas/material.js';
import { createMaterial, deleteMaterial, listMaterials, updateMaterial } from '../services/materials.js';

const router = Router();

router.use(requireAuth, requireDepartment('appeals'));

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
    const row = await createMaterial(data);
    await logAudit({
      userId: req.user!.id,
      entity: 'material',
      entityId: row.id,
      action: 'created',
      title: row.title,
      payload: { kind: row.kind },
    });
    res.status(201).json(row);
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
    const before = await prisma.material.findUnique({ where: { id } });
    const row = await updateMaterial(id, data);
    const fields = before ? changedKeys(before, data) : [];
    if (fields.length > 0) {
      await logAudit({
        userId: req.user!.id,
        entity: 'material',
        entityId: id,
        action: 'updated',
        title: row.title,
        payload: { fields, kind: row.kind },
      });
    }
    res.json(row);
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
    const before = await prisma.material.findUnique({ where: { id } });
    await deleteMaterial(id);
    await logAudit({
      userId: req.user!.id,
      entity: 'material',
      entityId: id,
      action: 'deleted',
      title: before?.title ?? '',
      payload: { kind: before?.kind ?? '' },
    });
    res.json({ ok: true });
  }),
);

export default router;
