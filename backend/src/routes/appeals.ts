import fs from 'node:fs';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { contentDisposition, safeOriginalName } from '../lib/fileName.js';
import { upload, uploadErrorMessage } from '../lib/upload.js';
import { requireAuth, requirePermission, requireSuperAdmin } from '../middleware/auth.js';
import {
  FILE_KINDS,
  checkReplySchema,
  createAppealSchema,
  listAppealsSchema,
  sendReplySchema,
  updateAppealSchema,
  type FileKind,
} from '../schemas/appeal.js';
import {
  addAppealFile,
  createAppeal,
  deleteAppeal,
  deleteAppealFile,
  getAppeal,
  getAppealFile,
  listAppeals,
  listLookups,
  updateAppeal,
} from '../services/appeals.js';
import { checkReply, generateReplyPdf, sendReplyFile } from '../services/replyFlow.js';

const router = Router();

router.use(requireAuth);

function queryStrings(query: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value !== '') out[key] = value;
  }
  return out;
}

function parseId(value: string | string[]): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get(
  '/lookups',
  requirePermission('appeals.view'),
  asyncHandler(async (_req, res) => {
    res.json(await listLookups());
  }),
);

router.get(
  '/',
  requirePermission('appeals.view'),
  asyncHandler(async (req, res) => {
    const query = listAppealsSchema.parse(queryStrings(req.query as Record<string, unknown>));
    res.json(await listAppeals(query, req.user!));
  }),
);

router.post(
  '/',
  requirePermission('appeals.create'),
  asyncHandler(async (req, res) => {
    const data = createAppealSchema.parse(req.body);
    const appeal = await createAppeal(data, req.user!.id);
    res.status(201).json(appeal);
  }),
);

router.get(
  '/:id',
  requirePermission('appeals.view'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    res.json(await getAppeal(id, req.user!));
  }),
);

router.patch(
  '/:id',
  requirePermission('appeals.edit'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const data = updateAppealSchema.parse(req.body);
    res.json(await updateAppeal(id, data, req.user!));
  }),
);

router.delete(
  '/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    await deleteAppeal(id);
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/check-reply',
  requirePermission('appeals.edit'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const body = checkReplySchema.parse(req.body);
    res.json(await checkReply(id, body.text, req.user!));
  }),
);

router.post(
  '/:id/pdf',
  requirePermission('appeals.edit'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    res.status(201).json(await generateReplyPdf(id, req.user!));
  }),
);

router.post(
  '/:id/send',
  requirePermission('appeals.edit'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const body = sendReplySchema.parse(req.body);
    res.json(await sendReplyFile(id, body.kind, body.email, req.user!));
  }),
);

router.post('/:id/files', requirePermission('appeals.edit'), (req, res, next) => {
  const id = parseId(req.params.id);
  const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
  if (!id || !FILE_KINDS.includes(kind as FileKind)) {
    res.status(400).json({ error: 'Некорректные параметры загрузки' });
    return;
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: uploadErrorMessage(err) });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Нужен файл' });
      return;
    }
    addAppealFile(id, req.user!, {
      kind: kind as FileKind,
      storedName: req.file.filename,
      originalName: safeOriginalName(req.file.originalname),
      mime: req.file.mimetype,
      size: req.file.size,
    })
      .then((appeal) => res.status(201).json(appeal))
      .catch(next);
  });
});

router.get(
  '/:id/files/:fileId',
  requirePermission('appeals.view'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const fileId = parseId(req.params.fileId);
    if (!id || !fileId) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const { file, fullPath } = await getAppealFile(id, fileId, req.user!);
    res.setHeader('Content-Type', file.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(file.original_name));
    fs.createReadStream(fullPath).pipe(res);
  }),
);

router.delete(
  '/:id/files/:fileId',
  requirePermission('appeals.edit'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const fileId = parseId(req.params.fileId);
    if (!id || !fileId) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    res.json(await deleteAppealFile(id, fileId, req.user!));
  }),
);

export default router;
