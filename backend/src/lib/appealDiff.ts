// Снимок полей обращения для истории. Даты уже в виде ГГГГ-ММ-ДД.
export interface AppealSnapshot {
  incoming_number: string;
  appeal_date: string;
  sender: string;
  sender_type: string;
  object_address: string;
  correspondent_number: string;
  correspondent_date: string | null;
  reply_deadline: string | null;
  reply_email: string;
  outgoing_number: string;
  outgoing_date: string | null;
  category: string;
  recognized_text: string;
  summary: string;
  draft_reply: string;
  final_reply: string;
  status: string;
  assignee_id: number | null;
}

export type AppealChanges = {
  [K in keyof AppealSnapshot]?: { from: AppealSnapshot[K]; to: AppealSnapshot[K] };
};

export function diffAppeal(before: AppealSnapshot, after: AppealSnapshot): AppealChanges {
  const changes: AppealChanges = {};
  if (before.incoming_number !== after.incoming_number) {
    changes.incoming_number = { from: before.incoming_number, to: after.incoming_number };
  }
  if (before.appeal_date !== after.appeal_date) {
    changes.appeal_date = { from: before.appeal_date, to: after.appeal_date };
  }
  if (before.sender !== after.sender) {
    changes.sender = { from: before.sender, to: after.sender };
  }
  if (before.sender_type !== after.sender_type) {
    changes.sender_type = { from: before.sender_type, to: after.sender_type };
  }
  if (before.object_address !== after.object_address) {
    changes.object_address = { from: before.object_address, to: after.object_address };
  }
  if (before.correspondent_number !== after.correspondent_number) {
    changes.correspondent_number = { from: before.correspondent_number, to: after.correspondent_number };
  }
  if (before.correspondent_date !== after.correspondent_date) {
    changes.correspondent_date = { from: before.correspondent_date, to: after.correspondent_date };
  }
  if (before.reply_deadline !== after.reply_deadline) {
    changes.reply_deadline = { from: before.reply_deadline, to: after.reply_deadline };
  }
  if (before.reply_email !== after.reply_email) {
    changes.reply_email = { from: before.reply_email, to: after.reply_email };
  }
  if (before.outgoing_number !== after.outgoing_number) {
    changes.outgoing_number = { from: before.outgoing_number, to: after.outgoing_number };
  }
  if (before.outgoing_date !== after.outgoing_date) {
    changes.outgoing_date = { from: before.outgoing_date, to: after.outgoing_date };
  }
  if (before.category !== after.category) {
    changes.category = { from: before.category, to: after.category };
  }
  if (before.recognized_text !== after.recognized_text) {
    changes.recognized_text = { from: before.recognized_text, to: after.recognized_text };
  }
  if (before.summary !== after.summary) {
    changes.summary = { from: before.summary, to: after.summary };
  }
  if (before.draft_reply !== after.draft_reply) {
    changes.draft_reply = { from: before.draft_reply, to: after.draft_reply };
  }
  if (before.final_reply !== after.final_reply) {
    changes.final_reply = { from: before.final_reply, to: after.final_reply };
  }
  if (before.status !== after.status) {
    changes.status = { from: before.status, to: after.status };
  }
  if (before.assignee_id !== after.assignee_id) {
    changes.assignee_id = { from: before.assignee_id, to: after.assignee_id };
  }
  return changes;
}

// Статус и назначение пишем отдельными событиями, остальное — одним «обновлено».
export function splitChanges(changes: AppealChanges) {
  const { status, assignee_id, ...rest } = changes;
  return { status, assignee: assignee_id, rest };
}
