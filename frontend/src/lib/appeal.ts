export const APPEAL_STATUSES = [
  'Новое',
  'В работе',
  'Ответ подготовлен',
  'На согласовании',
  'Завершено',
] as const;

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

export const MATERIAL_KINDS = [
  { kind: 'norm', label: 'Нормативные материалы' },
  { kind: 'phrase', label: 'Типовые формулировки' },
  { kind: 'example', label: 'Примеры ответов' },
] as const;

export const FILE_KINDS = [
  { kind: 'source', label: 'Исходный файл' },
  { kind: 'generated_pdf', label: 'Сформированный PDF' },
  { kind: 'signed_scan', label: 'Подписанный скан' },
] as const;

export const FIELD_LABELS: Record<string, string> = {
  incoming_number: 'Входящий номер',
  appeal_date: 'Дата обращения',
  sender: 'Отправитель',
  sender_type: 'Тип отправителя',
  object_address: 'Адрес объекта',
  correspondent_number: 'Номер документа отправителя',
  correspondent_date: 'Дата документа отправителя',
  reply_deadline: 'Срок ответа',
  reply_email: 'Email для ответа',
  outgoing_number: 'Исходящий номер',
  outgoing_date: 'Дата ответа',
  category: 'Категория',
  recognized_text: 'Распознанный текст',
  summary: 'Краткое содержание',
  draft_reply: 'Проект ответа',
  final_reply: 'Финальный текст ответа',
};

export function todayInput(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function kindLabel(kind: string): string {
  return FILE_KINDS.find((item) => item.kind === kind)?.label ?? kind;
}
