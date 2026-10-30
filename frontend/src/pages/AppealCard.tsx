import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { APPEAL_STATUSES, FIELD_LABELS, FILE_KINDS, SENDER_TYPES, kindLabel } from '@/lib/appeal';
import { formatBytes, formatDate, formatDateTime, getApiError } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useBusy } from '@/lib/useBusy';
import { CategoryField } from '@/components/CategoryField';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import { Appeal, AppealEvent, AppealFile, Lookups, Person } from '@/types';

interface FormState {
  incoming_number: string;
  appeal_date: string;
  sender: string;
  sender_type: string;
  object_address: string;
  correspondent_number: string;
  correspondent_date: string;
  reply_deadline: string;
  reply_email: string;
  outgoing_number: string;
  outgoing_date: string;
  category: string;
  recognized_text: string;
  summary: string;
  draft_reply: string;
  final_reply: string;
  status: string;
  assignee_id: number | null;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.gif,application/pdf,image/*';

function toForm(appeal: Appeal): FormState {
  return {
    incoming_number: appeal.incoming_number,
    appeal_date: appeal.appeal_date,
    sender: appeal.sender,
    sender_type: appeal.sender_type,
    object_address: appeal.object_address,
    correspondent_number: appeal.correspondent_number,
    correspondent_date: appeal.correspondent_date ?? '',
    reply_deadline: appeal.reply_deadline ?? '',
    reply_email: appeal.reply_email,
    outgoing_number: appeal.outgoing_number,
    outgoing_date: appeal.outgoing_date ?? '',
    category: appeal.category,
    recognized_text: appeal.recognized_text,
    summary: appeal.summary,
    draft_reply: appeal.draft_reply,
    final_reply: appeal.final_reply,
    status: appeal.status,
    assignee_id: appeal.assignee_id,
  };
}

function brief(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'не указано';
  if (key.endsWith('_date') || key === 'appeal_date' || key === 'reply_deadline') return formatDate(String(value));
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function sameText(left: string, right: string): boolean {
  const norm = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return norm(left) === norm(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function EventBody({ event }: { event: AppealEvent }) {
  const payload = event.payload ?? {};
  if (event.action === 'created') return <div>Создал обращение</div>;
  if (event.action === 'status_changed') {
    return (
      <div>
        Сменил статус: {String(payload.from ?? 'не указан')} → {String(payload.to ?? 'не указан')}
      </div>
    );
  }
  if (event.action === 'assigned') {
    const from = payload.from_name ? String(payload.from_name) : 'не назначен';
    const to = payload.to_name ? String(payload.to_name) : 'не назначен';
    return (
      <div>
        Ответственный: {from} → {to}
      </div>
    );
  }
  if (event.action === 'reply_checked') return <div>Проверил финальный текст</div>;
  if (event.action === 'reply_unchecked') return <div>Снял проверку: финальный текст изменён</div>;
  if (event.action === 'pdf_generated') {
    return <div>Сформировал PDF «{String(payload.name ?? 'файл')}»</div>;
  }
  if (event.action === 'email_sent') {
    return (
      <div>
        Отправил {kindLabel(String(payload.kind ?? ''))} на {String(payload.to ?? '')}
      </div>
    );
  }
  if (event.action === 'file_uploaded' || event.action === 'file_deleted') {
    const verb = event.action === 'file_uploaded' ? 'Загрузил' : 'Удалил';
    return (
      <div>
        {verb} «{String(payload.name ?? 'файл')}» ({kindLabel(String(payload.kind ?? ''))})
      </div>
    );
  }
  if (event.action === 'updated' && isRecord(payload.changes)) {
    const rows = Object.entries(payload.changes).filter((entry): entry is [string, Record<string, unknown>] =>
      isRecord(entry[1]),
    );
    return (
      <div>
        Изменил поля
        <ul>
          {rows.map(([key, change]) => (
            <li key={key}>
              {FIELD_LABELS[key] ?? key}: {brief(key, change.from)} → {brief(key, change.to)}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <div>{event.action}</div>;
}

export function AppealCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const canEdit = hasPermission('appeals.edit');
  const isAdmin = user?.role === 'super_admin';
  const seesNeutral = hasPermission('appeals.view_unassigned');

  function canSeeAssignee(assigneeId: number | null) {
    if (isAdmin) return true;
    if (assigneeId === user?.id) return true;
    return assigneeId == null && seesNeutral;
  }
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [lookups, setLookups] = useState<Lookups>({
    statuses: [...APPEAL_STATUSES],
    sender_types: [...SENDER_TYPES],
    categories: [],
    users: [],
  });
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [replyError, setReplyError] = useState('');
  const [missing, setMissing] = useState(false);
  const [sendKind, setSendKind] = useState<'generated_pdf' | 'signed_scan' | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const save = useBusy();
  const fileBusy = useBusy();
  const replyBusy = useBusy();

  const load = useCallback(async () => {
    setError('');
    setMissing(false);
    try {
      const [card, meta] = await Promise.all([
        api.get<Appeal>(`/appeals/${id}`),
        api.get<Lookups>('/appeals/lookups'),
      ]);
      setAppeal(card.data);
      setForm(toForm(card.data));
      setLookups(meta.data);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) setMissing(true);
      else setError(getApiError(err, 'Не удалось открыть обращение'));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFiles(next: Appeal) {
    setAppeal((current) => (current ? { ...current, files: next.files, events: next.events } : next));
  }

  function takeServer(next: Appeal) {
    setAppeal(next);
    setForm((current) => {
      if (!current) return toForm(next);
      return {
        ...current,
        final_reply: next.final_reply,
        outgoing_date: current.outgoing_date || next.outgoing_date || '',
      };
    });
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form || !appeal) return;
    setError('');
    save.run(async () => {
      try {
        const res = await api.patch<Appeal>(`/appeals/${appeal.id}`, {
          ...form,
          correspondent_date: form.correspondent_date || null,
          reply_deadline: form.reply_deadline || null,
          outgoing_date: form.outgoing_date || null,
        });
        setAppeal(res.data);
        setForm(toForm(res.data));
        if (!canSeeAssignee(res.data.assignee_id)) navigate('/appeals');
      } catch (err) {
        setError(getApiError(err, 'Не удалось сохранить'));
      }
    });
  }

  async function upload(kind: string, file: File | undefined, input: HTMLInputElement) {
    if (!file || !appeal) return;
    setFileError('');
    fileBusy.run(async () => {
      try {
        const body = new FormData();
        body.append('file', file);
        const res = await api.post<Appeal>(`/appeals/${appeal.id}/files?kind=${kind}`, body);
        applyFiles(res.data);
      } catch (err) {
        setFileError(getApiError(err, 'Не удалось загрузить файл'));
      } finally {
        input.value = '';
      }
    });
  }

  async function download(file: AppealFile) {
    if (!appeal) return;
    setFileError('');
    try {
      const res = await api.get(`/appeals/${appeal.id}/files/${file.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFileError(getApiError(err, 'Не удалось скачать файл'));
    }
  }

  async function removeFile(file: AppealFile) {
    if (!appeal || !confirm(`Удалить файл «${file.original_name}»?`)) return;
    setFileError('');
    fileBusy.run(async () => {
      try {
        const res = await api.delete<Appeal>(`/appeals/${appeal.id}/files/${file.id}`);
        applyFiles(res.data);
      } catch (err) {
        setFileError(getApiError(err, 'Не удалось удалить файл'));
      }
    });
  }

  function checkReply() {
    if (!form || !appeal) return;
    setReplyError('');
    replyBusy.run(async () => {
      try {
        const res = await api.post<Appeal>(`/appeals/${appeal.id}/check-reply`, { text: form.final_reply });
        takeServer(res.data);
      } catch (err) {
        setReplyError(getApiError(err, 'Не удалось отметить текст проверенным'));
      }
    });
  }

  function makePdf() {
    if (!appeal) return;
    setReplyError('');
    replyBusy.run(async () => {
      try {
        const res = await api.post<Appeal>(`/appeals/${appeal.id}/pdf`);
        takeServer(res.data);
      } catch (err) {
        setReplyError(getApiError(err, 'Не удалось сформировать PDF'));
      }
    });
  }

  async function openForPrint(file: AppealFile) {
    if (!appeal) return;
    setReplyError('');
    try {
      const res = await api.get(`/appeals/${appeal.id}/files/${file.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const win = window.open(url, '_blank');
      if (!win) {
        setReplyError('Браузер заблокировал окно. Разрешите всплывающие окна или скачайте PDF.');
        return;
      }
      window.setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          // Файл уже открыт, печать можно вызвать из окна.
        }
      }, 700);
    } catch (err) {
      setReplyError(getApiError(err, 'Не удалось открыть PDF'));
    }
  }

  function openSend(kind: 'generated_pdf' | 'signed_scan') {
    setSendKind(kind);
    setSendEmail(form?.reply_email || appeal?.reply_email || '');
    setReplyError('');
  }

  function sendFile(e: FormEvent) {
    e.preventDefault();
    if (!appeal || !sendKind) return;
    setReplyError('');
    replyBusy.run(async () => {
      try {
        const res = await api.post<Appeal>(`/appeals/${appeal.id}/send`, { kind: sendKind, email: sendEmail.trim() });
        takeServer(res.data);
        setSendKind(null);
      } catch (err) {
        setReplyError(getApiError(err, 'Не удалось отправить письмо'));
      }
    });
  }

  async function removeAppeal() {
    if (!appeal || !confirm(`Удалить обращение ${appeal.incoming_number}?`)) return;
    try {
      await api.delete(`/appeals/${appeal.id}`);
      navigate('/appeals');
    } catch (err) {
      setError(getApiError(err, 'Не удалось удалить обращение'));
    }
  }

  if (missing) {
    return (
      <div>
        <h1 className="page-title">Обращение не найдено</h1>
        <Link className="btn" to="/appeals">
          К реестру
        </Link>
      </div>
    );
  }

  if (!appeal || !form) {
    return <div className="text-muted">{error || 'Загрузка…'}</div>;
  }

  const people: Person[] = [...lookups.users];
  if (appeal.assignee && !people.some((person) => person.id === appeal.assignee!.id)) {
    people.push(appeal.assignee);
  }

  const textChecked =
    Boolean(appeal.reply_checked_at) &&
    sameText(appeal.final_reply, appeal.reply_checked_text) &&
    sameText(form.final_reply, appeal.reply_checked_text);
  const letterSaved =
    form.outgoing_number.trim() === appeal.outgoing_number.trim() &&
    (form.outgoing_date || '') === (appeal.outgoing_date || '');
  const canPdf = textChecked && letterSaved && Boolean(appeal.outgoing_number.trim());
  const latestPdf = appeal.files.find((file) => file.kind === 'generated_pdf');
  const latestScan = appeal.files.find((file) => file.kind === 'signed_scan');
  const pdfFresh =
    Boolean(latestPdf && appeal.reply_checked_at) &&
    new Date(latestPdf!.created_at).getTime() + 1000 >= new Date(appeal.reply_checked_at!).getTime();
  const pdfHint = !form.final_reply.trim()
    ? 'Сначала напишите финальный текст.'
    : !textChecked
      ? 'Сначала отметьте текст кнопкой «Проверено».'
      : !letterSaved
        ? 'Сохраните исходящий номер и дату ответа. PDF берёт их из карточки.'
        : !appeal.outgoing_number.trim()
          ? 'Укажите исходящий номер.'
          : !appeal.outgoing_date
            ? 'Дата ответа не указана. В бланк подставится сегодняшний день.'
            : '';

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            {appeal.incoming_number} <StatusBadge status={form.status} />
          </h1>
          <div className="text-muted">
            Создал {appeal.created_by.full_name} · {formatDateTime(appeal.created_at)}
          </div>
        </div>
        <div className="actions">
          <Link className="btn" to="/appeals">
            К реестру
          </Link>
          {canEdit && (
            <button className="btn btn--primary" type="submit" form="appeal-form" disabled={save.busy}>
              {save.busy ? <Spinner label="Сохранение…" /> : 'Сохранить'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="appeal-layout">
        <form id="appeal-form" className="card" onSubmit={onSave}>
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Входящий номер</label>
              <input
                className="input"
                value={form.incoming_number}
                onChange={(e) => setForm({ ...form, incoming_number: e.target.value })}
                disabled={!canEdit}
                required
              />
              <div className="field__hint">Номер по штампу входящих, например Вх 0814. Свою нумерацию система не ведёт.</div>
            </div>
            <div className="field">
              <label className="field__label">Дата по штампу</label>
              <input
                className="input"
                type="date"
                value={form.appeal_date}
                onChange={(e) => setForm({ ...form, appeal_date: e.target.value })}
                disabled={!canEdit}
                required
              />
            </div>
            <div className="field">
              <label className="field__label">Отправитель</label>
              <input
                className="input"
                value={form.sender}
                onChange={(e) => setForm({ ...form, sender: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="field">
              <label className="field__label">Тип отправителя</label>
              <select
                className="select"
                value={form.sender_type}
                onChange={(e) => setForm({ ...form, sender_type: e.target.value })}
                disabled={!canEdit}
              >
                <option value="">Не указан</option>
                {SENDER_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--full">
              <label className="field__label">Адрес объекта</label>
              <input
                className="input"
                value={form.object_address}
                onChange={(e) => setForm({ ...form, object_address: e.target.value })}
                disabled={!canEdit}
                placeholder="Дом, квартира или помещение"
              />
            </div>
            <div className="field">
              <label className="field__label">Номер документа отправителя</label>
              <input
                className="input"
                value={form.correspondent_number}
                onChange={(e) => setForm({ ...form, correspondent_number: e.target.value })}
                disabled={!canEdit}
              />
              <div className="field__hint">Номер на бланке отправителя, строка «На №» в нашем ответе.</div>
            </div>
            <div className="field">
              <label className="field__label">Дата документа отправителя</label>
              <input
                className="input"
                type="date"
                value={form.correspondent_date}
                onChange={(e) => setForm({ ...form, correspondent_date: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="field">
              <label className="field__label">Срок ответа</label>
              <input
                className="input"
                type="date"
                value={form.reply_deadline}
                onChange={(e) => setForm({ ...form, reply_deadline: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="field">
              <label className="field__label">Email для ответа</label>
              <input
                className="input"
                value={form.reply_email}
                onChange={(e) => setForm({ ...form, reply_email: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="field">
              <label className="field__label">Исходящий номер</label>
              <input
                className="input"
                value={form.outgoing_number}
                onChange={(e) => setForm({ ...form, outgoing_number: e.target.value })}
                disabled={!canEdit}
              />
              <div className="field__hint">Номер нашего ответа на фирменном бланке.</div>
            </div>
            <div className="field">
              <label className="field__label">Дата ответа</label>
              <input
                className="input"
                type="date"
                value={form.outgoing_date}
                onChange={(e) => setForm({ ...form, outgoing_date: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="field">
              <label className="field__label">Категория по сути</label>
              <CategoryField
                value={form.category}
                categories={lookups.categories}
                disabled={!canEdit}
                onChange={(category) => setForm({ ...form, category })}
              />
            </div>
            <div className="field">
              <label className="field__label">Статус</label>
              <select
                className="select"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                disabled={!canEdit}
              >
                {APPEAL_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Ответственный</label>
              <select
                className="select"
                value={form.assignee_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, assignee_id: e.target.value ? Number(e.target.value) : null })
                }
                disabled={!canEdit}
              >
                <option value="">Не назначен</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--full">
              <label className="field__label">Распознанный текст</label>
              <textarea
                className="textarea"
                rows={8}
                value={form.recognized_text}
                onChange={(e) => setForm({ ...form, recognized_text: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="field field--full">
              <label className="field__label">Краткое содержание</label>
              <textarea
                className="textarea"
                rows={3}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="field field--full">
              <label className="field__label">Проект ответа</label>
              <textarea
                className="textarea"
                rows={6}
                value={form.draft_reply}
                onChange={(e) => setForm({ ...form, draft_reply: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="field field--full">
              <label className="field__label">Финальный текст ответа</label>
              <textarea
                className="textarea"
                rows={6}
                value={form.final_reply}
                onChange={(e) => setForm({ ...form, final_reply: e.target.value })}
                disabled={!canEdit}
              />
              <div className="reply-box">
                {textChecked && appeal.reply_checked_at && (
                  <div className="reply-status">
                    Проверено{appeal.reply_checked_by ? `: ${appeal.reply_checked_by.full_name}` : ''},{' '}
                    {formatDateTime(appeal.reply_checked_at)}. После правки текста проверку нужно пройти снова.
                  </div>
                )}
                {!textChecked && appeal.reply_checked_text && (
                  <div>
                    <div className="field__hint">Текст отличается от проверенного. Нажмите «Проверено» ещё раз.</div>
                    <details>
                      <summary>Проверенный текст</summary>
                      <pre className="reply-previous">{appeal.reply_checked_text}</pre>
                    </details>
                  </div>
                )}
                {replyError && <div className="form-error">{replyError}</div>}
                {canEdit && (
                  <div className="actions" style={{ flexWrap: 'wrap' }}>
                    {!textChecked && (
                      <button className="btn btn--sm" type="button" onClick={checkReply} disabled={replyBusy.busy || !form.final_reply.trim()}>
                        Проверено
                      </button>
                    )}
                    <button className="btn btn--sm" type="button" onClick={makePdf} disabled={replyBusy.busy || !canPdf}>
                      Сформировать PDF
                    </button>
                    {latestPdf && pdfFresh && (
                      <button className="btn btn--sm" type="button" onClick={() => openForPrint(latestPdf)}>
                        Открыть для печати
                      </button>
                    )}
                    {latestPdf && pdfFresh && (
                      <button className="btn btn--sm" type="button" onClick={() => openSend('generated_pdf')}>
                        Отправить PDF
                      </button>
                    )}
                    {latestScan && (
                      <button className="btn btn--sm" type="button" onClick={() => openSend('signed_scan')}>
                        Отправить скан
                      </button>
                    )}
                  </div>
                )}
                {pdfHint && <div className="field__hint">{pdfHint}</div>}
              </div>
            </div>
          </div>
        </form>

        <div className="card">
          <h2 className="section-title">Файлы</h2>
          {fileError && <div className="form-error">{fileError}</div>}
          {FILE_KINDS.map((item) => {
            const current = appeal.files.find((file) => file.kind === item.kind);
            const older = appeal.files.filter((file) => file.kind === item.kind && file.id !== current?.id);
            return (
              <div className="file-kind" key={item.kind}>
                <div className="field__label">{item.label}</div>
                {current ? (
                  <div>
                    <div>{current.original_name}</div>
                    <div className="text-muted">
                      {formatBytes(current.size)} · {current.uploaded_by.full_name} ·{' '}
                      {formatDateTime(current.created_at)}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted">Файл не загружен</div>
                )}
                <div className="file-kind__actions">
                  {current && (
                    <button className="btn btn--sm" type="button" onClick={() => download(current)}>
                      Скачать
                    </button>
                  )}
                  {canEdit && (
                    <label className="btn btn--sm">
                      {current ? 'Заменить' : 'Загрузить'}
                      <input
                        type="file"
                        hidden
                        accept={ACCEPT}
                        disabled={fileBusy.busy}
                        onChange={(e) => upload(item.kind, e.target.files?.[0], e.target)}
                      />
                    </label>
                  )}
                  {canEdit && current && (
                    <button className="btn btn--sm btn--danger" type="button" onClick={() => removeFile(current)}>
                      Удалить
                    </button>
                  )}
                </div>
                {older.length > 0 && (
                  <div className="text-muted" style={{ marginTop: 8 }}>
                    Предыдущие:{' '}
                    {older.map((file) => (
                      <button
                        key={file.id}
                        className="btn btn--sm"
                        type="button"
                        style={{ margin: '4px 4px 0 0' }}
                        onClick={() => download(file)}
                      >
                        {file.original_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">История</h2>
        <div className="history-list">
          {appeal.events.map((event) => (
            <div className="history-item" key={event.id}>
              <div className="text-muted">{formatDateTime(event.created_at)}</div>
              <div>
                <strong>{event.user.full_name}</strong>
                <EventBody event={event} />
              </div>
            </div>
          ))}
          {appeal.events.length === 0 && <div className="text-muted">Событий пока нет</div>}
        </div>
      </div>

      {isAdmin && (
        <div>
          <button className="btn btn--danger" type="button" onClick={removeAppeal}>
            Удалить обращение
          </button>
        </div>
      )}

      <Modal
        open={sendKind != null}
        title={sendKind === 'signed_scan' ? 'Отправить подписанный скан' : 'Отправить PDF'}
        width={440}
        onClose={() => setSendKind(null)}
      >
        <form onSubmit={sendFile}>
          <div className="field__hint" style={{ marginBottom: 12 }}>
            Письмо уходит только по этой кнопке. Само оно не отправляется.
          </div>
          {replyError && <div className="form-error">{replyError}</div>}
          <div className="field">
            <label className="field__label">Адрес получателя</label>
            <input
              className="input"
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={replyBusy.busy}>
              {replyBusy.busy ? <Spinner label="Отправка…" /> : 'Отправить'}
            </button>
            <button className="btn" type="button" onClick={() => setSendKind(null)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
