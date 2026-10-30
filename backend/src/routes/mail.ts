import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { listInbox, markMailSeen } from '../services/mail.js';

const router = Router();

router.use(requireAuth);

const dismissSchema = z.object({
  uid: z.number().int().positive(),
  uid_validity: z.string().trim().max(40),
});

router.get(
  '/',
  requirePermission('appeals.create'),
  asyncHandler(async (_req, res) => {
    res.json(await listInbox());
  }),
);

router.post(
  '/dismiss',
  requirePermission('appeals.create'),
  asyncHandler(async (req, res) => {
    const body = dismissSchema.parse(req.body);
    await markMailSeen(body.uid, body.uid_validity);
    res.json({ ok: true });
  }),
);

export default router;
