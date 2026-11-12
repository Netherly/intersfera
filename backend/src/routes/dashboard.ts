import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireDepartment, requirePermission } from '../middleware/auth.js';
import { getDashboard } from '../services/dashboard.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireDepartment('appeals'),
  requirePermission('appeals.view'),
  asyncHandler(async (req, res) => {
    res.json(await getDashboard(req.user!));
  }),
);

export default router;
