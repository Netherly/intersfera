import { z } from 'zod';

export const APPEAL_STATUSES = [
  'Новое',
  'В работе',
  'Ответ подготовлен',
  'На согласовании',
  'Завершено',
] as const;

export const FILE_KINDS = ['source', 'generated_pdf', 'signed_scan'] as const;

export const SENDER_TYPES = [
  'Собственник',
  'Старшая по дому',
  'Администрация',
  'Прокуратура',
  'УЖВ',
  'Ресурсоснабжающая организация',
  'Фонд капитального ремонта',
  'Иное',
] as const;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата');
const optionalDate = z.union([dateOnly, z.null()]);
const longText = z.string().max(100_000);
const senderType = z.union([z.enum(SENDER_TYPES), z.literal('')]);

export const APPEAL_DIRECTIONS = ['incoming', 'outgoing'] as const;

export const createAppealSchema = z.object({
  incoming_number: z.string().trim().min(1, 'Укажите номер').max(64),
  appeal_date: dateOnly.optional(),
  direction: z.enum(APPEAL_DIRECTIONS).optional(),
  sender: z.string().trim().max(300).optional(),
  final_reply: longText.optional(),
  sender_type: senderType.optional(),
  object_address: z.string().trim().max(300).optional(),
  category: z.string().trim().max(200).optional(),
  assignee_id: z.number().int().positive().nullable().optional(),
  summary: longText.optional(),
  recognized_text: longText.optional(),
  reply_email: z.string().trim().max(200).optional(),
  mail_uid: z.number().int().positive().optional(),
  mail_uid_validity: z.string().trim().max(40).optional(),
});

export const checkReplySchema = z.object({
  text: z.string().max(100_000),
});

export const sendReplySchema = z.object({
  kind: z.enum(['generated_pdf', 'signed_scan']),
  email: z.string().trim().min(3).max(200),
});

export const updateAppealSchema = z
  .object({
    incoming_number: z.string().trim().min(1, 'Укажите входящий номер').max(64).optional(),
    appeal_date: dateOnly.optional(),
    sender: z.string().trim().max(300).optional(),
    sender_type: senderType.optional(),
    object_address: z.string().trim().max(300).optional(),
    correspondent_number: z.string().trim().max(100).optional(),
    correspondent_date: optionalDate.optional(),
    reply_deadline: optionalDate.optional(),
    reply_email: z.string().trim().max(200).optional(),
    outgoing_number: z.string().trim().max(64).optional(),
    outgoing_date: optionalDate.optional(),
    category: z.string().trim().max(200).optional(),
    recognized_text: longText.optional(),
    summary: longText.optional(),
    draft_reply: longText.optional(),
    final_reply: longText.optional(),
    status: z.enum(APPEAL_STATUSES).optional(),
    assignee_id: z.number().int().positive().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Нет полей для обновления' });

export const listAppealsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(APPEAL_STATUSES).optional(),
  category: z.string().trim().max(200).optional(),
  sender_type: senderType.optional(),
  assignee_id: z.coerce.number().int().positive().optional(),
  unassigned: z.enum(['1', 'true']).optional(),
  direction: z.enum(APPEAL_DIRECTIONS).optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export type CreateAppealInput = z.infer<typeof createAppealSchema>;
export type UpdateAppealInput = z.infer<typeof updateAppealSchema>;
export type ListAppealsInput = z.infer<typeof listAppealsSchema>;
export type CheckReplyInput = z.infer<typeof checkReplySchema>;
export type SendReplyInput = z.infer<typeof sendReplySchema>;
export type FileKind = (typeof FILE_KINDS)[number];
