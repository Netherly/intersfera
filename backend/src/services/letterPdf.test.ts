import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderLetterPdf } from './letterPdf';

const font = path.resolve(process.cwd(), 'assets/fonts/LiberationSerif-Regular.ttf');

describe('бланк PDF', () => {
  it('собирает файл с кириллицей', async () => {
    try {
      await access(font);
    } catch {
      return;
    }
    const buffer = await renderLetterPdf({
      sender: 'Иванов И.И.',
      objectAddress: 'ул. Есенина, д. 1',
      replyEmail: 'test@example.com',
      outgoingNumber: '0836/26',
      outgoingDate: '20.10.2026',
      correspondentNumber: '38.6НЭ-02-23700',
      correspondentDate: '01.10.2026',
      body: 'Добрый день.\n\nНаправляем ответ.',
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });
});