export const DEPARTMENT_IDS = ['appeals', 'legal', 'accounting', 'technical'] as const;

export type DepartmentId = (typeof DEPARTMENT_IDS)[number];

export const DEPARTMENTS: { id: DepartmentId; label: string }[] = [
  { id: 'appeals', label: 'Обращения' },
  { id: 'legal', label: 'Юристы' },
  { id: 'accounting', label: 'Бухгалтерия' },
  { id: 'technical', label: 'Техники' },
];

export function isDepartmentId(value: string): value is DepartmentId {
  return (DEPARTMENT_IDS as readonly string[]).includes(value);
}
