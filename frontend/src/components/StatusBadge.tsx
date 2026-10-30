const STATUS_CLASS: Record<string, string> = {
  Новое: 'badge--blue',
  'В работе': 'badge--amber',
  'Ответ подготовлен': 'badge--purple',
  'На согласовании': 'badge--white',
  Завершено: 'badge--green',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_CLASS[status] ?? 'badge--gray'}`}>{status}</span>;
}
