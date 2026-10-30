import { describe, expect, it } from 'vitest';
import { assertChecked } from './replyFlow';

describe('проверка финального текста', () => {
  it('без отметки не готова к бланку', () => {
    expect(() =>
      assertChecked({ final_reply: 'Текст', reply_checked_text: '', reply_checked_at: null }),
    ).toThrow(/проверен/);
  });

  it('совпадающий текст проходит', () => {
    expect(() =>
      assertChecked({
        final_reply: 'Текст\r\n',
        reply_checked_text: 'Текст\n',
        reply_checked_at: new Date(),
      }),
    ).not.toThrow();
  });

  it('правка после проверки снова требует отметку', () => {
    expect(() =>
      assertChecked({
        final_reply: 'Новый текст',
        reply_checked_text: 'Старый текст',
        reply_checked_at: new Date(),
      }),
    ).toThrow(/проверен/);
  });
});
