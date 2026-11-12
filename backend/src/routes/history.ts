import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { listHistory } from '../services/history.js';

const router = Router();

const querySchema = z.object({
  source: z.enum(['all', 'incoming', 'outgoing', 'admin']).default('all'),
  user_id: z.coerce.number().int().positive().optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const allowed =
      user.role === 'super_admin' ||
      (user.departments.includes('appeals') && user.permissions.includes('appeals.view'));
    if (!allowed) {
      res.status(403).json({ error: 'Недостаточно прав' });
      return;
    }
    const raw: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && value !== '') raw[key] = value;
    }
    const query = querySchema.parse(raw);
    res.json(
      await listHistory(
        {
          source: query.source,
          user_id: query.user_id,
          before: query.before ? new Date(query.before) : undefined,
          limit: query.limit,
        },
        user,
      ),
    );
  }),
);

export default router;
