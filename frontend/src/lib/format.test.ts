import { describe, expect, it } from 'vitest';
import { formatDate, getApiError } from './format';

describe('formatDate', () => {
  it('показывает календарную дату без сдвига пояса', () => {
    expect(formatDate('2026-10-26')).toBe('26.10.2026');
  });
});

describe('getApiError', () => {
  it('берёт текст из ответа API', () => {
    expect(getApiError({ response: { data: { error: 'Занято' } } })).toBe('Занято');
  });

  it('возвращает запасной текст', () => {
    expect(getApiError(new Error('x'), 'Сбой')).toBe('Сбой');
  });
});
