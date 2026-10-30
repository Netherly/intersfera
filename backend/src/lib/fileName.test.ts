import { describe, expect, it } from 'vitest';
import { contentDisposition, safeOriginalName } from './fileName.js';

describe('safeOriginalName', () => {
  it('оставляет обычное имя', () => {
    expect(safeOriginalName('scan.pdf')).toBe('scan.pdf');
  });

  it('срезает путь', () => {
    expect(safeOriginalName('../../etc/passwd')).toBe('passwd');
  });

  it('пустое имя заменяет', () => {
    expect(safeOriginalName('   ')).toBe('file');
  });
});

describe('contentDisposition', () => {
  it('кодирует имя в UTF-8', () => {
    const header = contentDisposition('скан.pdf');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain(encodeURIComponent('скан.pdf'));
  });
});
