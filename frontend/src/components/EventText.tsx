import { FIELD_LABELS, kindLabel } from '@/lib/appeal';
import { formatDate } from '@/lib/format';

const ENTITY_LABELS: Record<string, string> = {
  user: 'пользователя',
  role: 'роль',
  category: 'категорию',
  addressee: 'адресата',
  material: 'запись базы',
};

const ADMIN_FIELD_LABELS: Record<string, string> = {
  full_name: 'ФИО',
  login: 'логин',
  password: 'пароль',
  role: 'тип доступа',
  role_id: 'роль',
  departments: 'отделы',
  is_active: 'статус',
  name: 'название',
  permissions: 'доступы',
  title: 'название',
  citation: 'статьи',
  body: 'текст',
};

function brief(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'не указано';
  if (key.endsWith('_date') || key === 'reply_deadline') return formatDate(String(value));
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function AppealEventText({ action, payload: raw }: { action: string; payload: unknown }) {
  const payload = isRecord(raw) ? raw : {};
  if (action === 'created') return <div>Создал запись</div>;
  if (action === 'status_changed') {
    return (
      <div>
        Сменил статус: {String(payload.from ?? 'не указан')} → {String(payload.to ?? 'не указан')}
      </div>
    );
  }
  if (action === 'assigned') {
    const from = payload.from_name ? String(payload.from_name) : 'не назначен';
    const to = payload.to_name ? String(payload.to_name) : 'не назначен';
    return (
      <div>
        Ответственный: {from} → {to}
      </div>
    );
  }
  if (action === 'reply_checked') return <div>Проверил финальный текст</div>;
  if (action === 'reply_unchecked') return <div>Снял проверку: финальный текст изменён</div>;
  if (action === 'pdf_generated') return <div>Сформировал PDF «{String(payload.name ?? 'файл')}»</div>;
  if (action === 'email_sent') {
    return (
      <div>
        Отправил {kindLabel(String(payload.kind ?? ''))} на {String(payload.to ?? '')}
      </div>
    );
  }
  if (action === 'file_uploaded' || action === 'file_deleted') {
    const verb = action === 'file_uploaded' ? 'Загрузил' : 'Удалил';
    return (
      <div>
        {verb} «{String(payload.name ?? 'файл')}» ({kindLabel(String(payload.kind ?? ''))})
      </div>
    );
  }
  if (action === 'updated' && isRecord(payload.changes)) {
    const rows = Object.entries(payload.changes).filter((entry): entry is [string, Record<string, unknown>] =>
      isRecord(entry[1]),
    );
    return (
      <div>
        Изменил поля
        <ul>
          {rows.map(([key, change]) => (
            <li key={key}>
              {FIELD_LABELS[key] ?? key}: {brief(key, change.from)} → {brief(key, change.to)}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <div>{action}</div>;
}

export function AdminEventText({
  action,
  entity,
  title,
  payload: raw,
}: {
  action: string;
  entity: string;
  title: string;
  payload: unknown;
}) {
  const payload = isRecord(raw) ? raw : {};
  const what = ENTITY_LABELS[entity] ?? entity;
  const verb = action === 'created' ? 'Создал' : action === 'deleted' ? 'Удалил' : 'Изменил';
  const fields = Array.isArray(payload.fields)
    ? payload.fields.map((key) => ADMIN_FIELD_LABELS[String(key)] ?? String(key))
    : [];
  const renamed = typeof payload.from === 'string' && payload.from !== title ? payload.from : '';
  return (
    <div>
      {verb} {what} «{title}»
      {renamed && <> (было «{renamed}»)</>}
      {fields.length > 0 && <>: {fields.join(', ')}</>}
    </div>
  );
}
