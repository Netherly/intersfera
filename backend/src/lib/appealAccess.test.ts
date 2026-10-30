import { describe, expect, it } from 'vitest';
import { appealVisibilityWhere, canSeeAppeal } from './appealAccess';

const employee = { id: 4, role: 'user', permissions: ['appeals.view'] };
const withNeutral = { ...employee, permissions: ['appeals.view', 'appeals.view_unassigned'] };
const admin = { id: 1, role: 'super_admin', permissions: [] };

describe('видимость обращений', () => {
  it('сотрудник видит только свои', () => {
    expect(appealVisibilityWhere(employee)).toEqual({ assignee_id: 4 });
    expect(canSeeAppeal(4, employee)).toBe(true);
    expect(canSeeAppeal(null, employee)).toBe(false);
    expect(canSeeAppeal(9, employee)).toBe(false);
  });

  it('доступ к нейтральным добавляет обращения без ответственного', () => {
    expect(appealVisibilityWhere(withNeutral)).toEqual({
      OR: [{ assignee_id: 4 }, { assignee_id: null }],
    });
    expect(canSeeAppeal(null, withNeutral)).toBe(true);
    expect(canSeeAppeal(9, withNeutral)).toBe(false);
  });

  it('супер-админ видит все', () => {
    expect(appealVisibilityWhere(admin)).toEqual({});
    expect(canSeeAppeal(null, admin)).toBe(true);
    expect(canSeeAppeal(9, admin)).toBe(true);
  });
});
