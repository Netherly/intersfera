import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireDepartment, requirePermission } from '../middleware/auth.js';
import { listInbox, markMailSeen, readMailAttachment } from '../services/mail.js';

const router = Router();

router.use(requireAuth, requireDepartment('appeals'));

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

const DEMO_FILES: Record<string, { filename: string; size: number }[]> = {
  'demo-2': [{ filename: 'Адреса отключения.txt', size: 180 }],
  'demo-3': [{ filename: 'Запрос.txt', size: 160 }],
};

router.get(
  '/:uid/attachments/:index',
  requirePermission('appeals.create'),
  asyncHandler(async (req, res) => {
    const uid = Number(req.params.uid);
    const index = Number(req.params.index);
    const uidValidity = typeof req.query.uid_validity === 'string' ? req.query.uid_validity : '';
    if (!Number.isInteger(uid) || uid < 0 || !Number.isInteger(index) || index < 0) {
      res.status(400).json({ error: 'Некорректное вложение' });
      return;
    }
    if (uid === 0) {
      const file = DEMO_FILES[uidValidity]?.[index];
      if (!file) {
        res.status(404).json({ error: 'Вложение не найдено' });
        return;
      }
      const body = `Это пример вложения «${file.filename}».\nНастоящий файл появится, когда почта будет подключена.\n`;
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
      res.type('text/plain; charset=utf-8').send(body);
      return;
    }
    const file = await readMailAttachment(uid, uidValidity, index);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.type(file.contentType).send(file.content);
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
