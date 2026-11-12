// Каталог доступов. Используется и для проверки прав, и на странице «Доступы».

export interface PermissionItem {
  key: string;
  label: string;
}
export interface PermissionGroup {
  group: string;
  items: PermissionItem[];
}

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    group: 'Обращения',
    items: [
      { key: 'appeals.view', label: 'Просмотр' },
      { key: 'appeals.view_unassigned', label: 'Нейтральные обращения' },
      { key: 'appeals.create', label: 'Создание' },
      { key: 'appeals.edit', label: 'Редактирование' },
    ],
  },
  {
    group: 'Базы',
    items: [
      { key: 'materials.view', label: 'Просмотр' },
      { key: 'materials.edit', label: 'Редактирование' },
    ],
  },
  {
    group: 'Юристы',
    items: [{ key: 'legal.view', label: 'Просмотр' }],
  },
  {
    group: 'Бухгалтерия',
    items: [{ key: 'accounting.view', label: 'Просмотр' }],
  },
  {
    group: 'Техники',
    items: [{ key: 'technical.view', label: 'Просмотр' }],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((g) =>
  g.items.map((i) => i.key),
);
