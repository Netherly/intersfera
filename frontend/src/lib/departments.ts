export const DEPARTMENTS = [
  { id: 'appeals', label: 'Обращения' },
  { id: 'legal', label: 'Юристы' },
  { id: 'accounting', label: 'Бухгалтерия' },
  { id: 'technical', label: 'Техники' },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]['id'];

export function departmentLabel(id: string): string {
  return DEPARTMENTS.find((item) => item.id === id)?.label ?? id;
}

export function isDepartmentId(value: string): value is DepartmentId {
  return DEPARTMENTS.some((item) => item.id === value);
}
