import { describe, expect, it } from 'vitest';
import { formatDateOnly, parseDateOnly } from './dates.js';

describe('parseDateOnly', () => {
  it('сохраняет календарный день', () => {
    expect(formatDateOnly(parseDateOnly('2026-10-26'))).toBe('2026-10-26');
  });

  it('принимает 29 февраля високосного года', () => {
    expect(formatDateOnly(parseDateOnly('2024-02-29'))).toBe('2024-02-29');
  });

  it('отклоняет несуществующий день', () => {
    expect(() => parseDateOnly('2026-02-31')).toThrow(/Некорректная дата/);
    expect(() => parseDateOnly('2026-02-29')).toThrow(/Некорректная дата/);
  });
});
