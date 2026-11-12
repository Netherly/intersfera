import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { changedKeys, logAudit } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { createAddresseeSchema, updateAddresseeSchema } from '../schemas/addressee.js';
import { deleteAddressee, listAddressees, saveAddressee, updateAddressee } from '../services/addressees.js';

const router = Router();

router.use(requireAuth);

function canWrite(req: { user?: { role: string; permissions: string[] } }): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return user.permissions.includes('appeals.create') || user.permissions.includes('appeals.edit');
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const allowed =
      user.role === 'super_admin' ||
      user.permissions.includes('appeals.view') ||
      user.permissions.includes('appeals.create') ||
      user.permissions.includes('appeals.edit');
    if (!allowed) {
      res.status(403).json({ error: 'Недостаточно прав' });
      return;
    }
    res.json(await listAddressees());
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!canWrite(req)) {
      res.status(403).json({ error: 'Недостаточно прав' });
      return;
    }
    const data = createAddresseeSchema.parse(req.body);
    const saved = await saveAddressee(data.name, data.email);
    if (saved.result === 'created') {
      await logAudit({
        userId: req.user!.id,
        entity: 'addressee',
        entityId: saved.row.id,
        action: 'created',
        title: saved.row.name,
      });
    } else if (saved.result === 'updated') {
      await logAudit({
        userId: req.user!.id,
        entity: 'addressee',
        entityId: saved.row.id,
        action: 'updated',
        title: saved.row.name,
        payload: { fields: ['email'] },
      });
    }
    res.status(saved.result === 'created' ? 201 : 200).json(saved.row);
  }),
);

router.patch(
  '/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const data = updateAddresseeSchema.parse(req.body);
    const before = await prisma.addressee.findUnique({ where: { id } });
    const updated = await updateAddressee(id, data);
    const fields = before ? changedKeys(before, data) : [];
    if (updated && fields.length > 0) {
      await logAudit({
        userId: req.user!.id,
        entity: 'addressee',
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
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const before = await prisma.addressee.findUnique({ where: { id } });
    await deleteAddressee(id);
    await logAudit({ userId: req.user!.id, entity: 'addressee', entityId: id, action: 'deleted', title: before?.name ?? '' });
    res.json({ ok: true });
  }),
);

export default router;
