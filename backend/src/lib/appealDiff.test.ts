import { describe, expect, it } from 'vitest';
import { diffAppeal, splitChanges, type AppealSnapshot } from './appealDiff.js';

function snapshot(patch: Partial<AppealSnapshot> = {}): AppealSnapshot {
  return {
    incoming_number: '1/26',
    appeal_date: '2026-10-26',
    sender: '',
    sender_type: '',
    object_address: '',
    correspondent_number: '',
    correspondent_date: null,
    reply_deadline: null,
    reply_email: '',
    outgoing_number: '',
    outgoing_date: null,
    category: '',
    recognized_text: '',
    summary: '',
    draft_reply: '',
    final_reply: '',
    status: 'Новое',
    assignee_id: null,
    ...patch,
  };
}

describe('diffAppeal', () => {
  it('пустой, если поля не менялись', () => {
    expect(diffAppeal(snapshot(), snapshot())).toEqual({});
  });

  it('видит смену статуса и текста', () => {
    const changes = diffAppeal(
      snapshot(),
      snapshot({ status: 'В работе', summary: 'Кратко' }),
    );
    expect(changes.status).toEqual({ from: 'Новое', to: 'В работе' });
    expect(changes.summary).toEqual({ from: '', to: 'Кратко' });
    expect(changes.sender).toBeUndefined();
  });
});

describe('splitChanges', () => {
  it('отделяет статус и ответственного от остальных полей', () => {
    const changes = diffAppeal(
      snapshot(),
      snapshot({ status: 'В работе', assignee_id: 3, sender: 'Иванов' }),
    );
    const split = splitChanges(changes);
    expect(split.status?.to).toBe('В работе');
    expect(split.assignee?.to).toBe(3);
    expect(split.rest).toEqual({ sender: { from: '', to: 'Иванов' } });
  });
});
