import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { APPEAL_STATUSES, SENDER_TYPES, todayInput } from '@/lib/appeal';
import { formatDate, getApiError } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useBusy } from '@/lib/useBusy';
import { CategoryField } from '@/components/CategoryField';
import { Modal } from '@/components/Modal';
import { Pagination } from '@/components/Pagination';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import { AppealListItem, Lookups, MailDraft, Paginated } from '@/types';

interface Draft {
  incoming_number: string;
  appeal_date: string;
  sender: string;
  sender_type: string;
  object_address: string;
  category: string;
  assignee_id: number | null;
  summary: string;
  recognized_text: string;
  reply_email: string;
  mail_uid: number | null;
  mail_uid_validity: string;
}

const emptyDraft = (): Draft => ({
  incoming_number: '',
  appeal_date: todayInput(),
  sender: '',
  sender_type: '',
  object_address: '',
  category: '',
  assignee_id: null,
  summary: '',
  recognized_text: '',
  reply_email: '',
  mail_uid: null,
  mail_uid_validity: '',
});

export function Appeals() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission('appeals.create');
  const seesAll = user?.role === 'super_admin';
  const seesNeutral = hasPermission('appeals.view_unassigned');
  const [items, setItems] = useState<AppealListItem[]>([]);
  const [lookups, setLookups] = useState<Lookups>({
    statuses: [...APPEAL_STATUSES],
    sender_types: [...SENDER_TYPES],
    categories: [],
    users: [],
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const direction = searchParams.get('direction') === 'outgoing' ? 'outgoing' : 'incoming';
  const statusFromUrl = searchParams.get('status') ?? '';
  const unassignedFromUrl = searchParams.get('unassigned') === '1';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(statusFromUrl);
  const [senderType, setSenderType] = useState('');
  const [category, setCategory] = useState('');
  const [assignee, setAssignee] = useState(unassignedFromUrl ? 'none' : '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [createError, setCreateError] = useState('');
  const save = useBusy();

  const load = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, string | number> = { page, pageSize: 20, direction };
      if (q) params.q = q;
      if (status) params.status = status;
      if (senderType) params.sender_type = senderType;
      if (category) params.category = category;
      if (assignee === 'none') params.unassigned = '1';
      else if (assignee === 'me' && user) params.assignee_id = user.id;
      else if (assignee) params.assignee_id = Number(assignee);

      const [list, meta] = await Promise.all([
        api.get<Paginated<AppealListItem>>('/appeals', { params }),
        api.get<Lookups>('/appeals/lookups'),
      ]);
      setItems(list.data.items);
      setTotalPages(list.data.totalPages);
      setTotal(list.data.total);
      setLookups(meta.data);
    } catch (err) {
      setError(getApiError(err, 'Не удалось загрузить реестр'));
    } finally {
      setLoaded(true);
    }
  }, [q, status, senderType, category, assignee, page, user, direction]);

  useEffect(() => {
    setStatus(statusFromUrl);
    setAssignee(unassignedFromUrl ? 'none' : '');
    setPage(1);
  }, [statusFromUrl, unassignedFromUrl]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate(fromMail?: MailDraft) {
    const next = emptyDraft();
    if (user && !seesAll && !seesNeutral) next.assignee_id = user.id;
    if (fromMail) {
      next.sender = fromMail.from.slice(0, 300);
      next.summary = fromMail.subject.slice(0, 2000);
      const files = (fromMail.attachments ?? []).map((file) => file.filename).join(', ');
      next.recognized_text = files ? `${fromMail.text}\n\nВложения: ${files}`.trim() : fromMail.text;
      next.reply_email = fromMail.email.slice(0, 200);
      next.mail_uid = fromMail.uid;
      next.mail_uid_validity = fromMail.uid_validity;
    }
    setDraft(next);
    setCreateError('');
    setShowCreate(true);
  }

  useEffect(() => {
    const mail = (location.state as { mail?: MailDraft } | null)?.mail;
    if (!mail || !canCreate) return;
    openCreate(mail);
    navigate('/appeals', { replace: true, state: null });
    // Карточка из письма открывается один раз на переход.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    save.run(async () => {
      try {
        const res = await api.post<{ id: number; assignee_id: number | null }>('/appeals', {
          incoming_number: draft.incoming_number.trim(),
          appeal_date: draft.appeal_date,
          sender: draft.sender.trim(),
          sender_type: draft.sender_type,
          object_address: draft.object_address.trim(),
          category: draft.category.trim(),
          assignee_id: draft.assignee_id,
          summary: draft.summary,
          recognized_text: draft.recognized_text,
          reply_email: draft.reply_email.trim(),
          ...(draft.mail_uid
            ? { mail_uid: draft.mail_uid, mail_uid_validity: draft.mail_uid_validity }
            : {}),
        });
        const assigneeId = res.data.assignee_id;
        const visible =
          seesAll ||
          assigneeId === user?.id ||
          (assigneeId == null && seesNeutral);
        setShowCreate(false);
        navigate(visible ? `/appeals/${res.data.id}` : '/appeals');
      } catch (err) {
        setCreateError(getApiError(err, 'Не удалось создать обращение'));
      }
    });
  }

  function showDirection(next: 'incoming' | 'outgoing') {
    const params = new URLSearchParams();
    if (next === 'outgoing') params.set('direction', 'outgoing');
    setSearchParams(params);
    setQ('');
    setSenderType('');
    setCategory('');
    setStatus('');
    setAssignee('');
    setPage(1);
  }

  return (
    <div className="page-fill">
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Реестр
        </h1>
        {canCreate && direction === 'incoming' && (
          <button className="btn btn--primary" onClick={() => openCreate()}>
            Новое обращение
          </button>
        )}
      </div>
      <div className="tabs">
        <button
          type="button"
          className={direction === 'incoming' ? 'tab tab--active' : 'tab'}
          onClick={() => showDirection('incoming')}
        >
          Входящие
        </button>
        <button
          type="button"
          className={direction === 'outgoing' ? 'tab tab--active' : 'tab'}
          onClick={() => showDirection('outgoing')}
        >
          Исходящие
        </button>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder={direction === 'outgoing' ? 'Номер или адресат' : 'Номер, отправитель или адрес'}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          {APPEAL_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {direction === 'incoming' && (
        <select
          className="select"
          value={senderType}
          onChange={(e) => {
            setSenderType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все типы</option>
          {SENDER_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        )}
        <select
          className="select"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все категории</option>
          {lookups.categories.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        {(seesAll || seesNeutral) && (
          <select
            className="select"
            value={assignee}
            onChange={(e) => {
              setAssignee(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{seesAll ? 'Все сотрудники' : 'Мои и нейтральные'}</option>
            <option value="me">Только мои</option>
            {seesNeutral && <option value="none">Нейтральные</option>}
            {seesAll &&
              lookups.users.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.full_name}
                </option>
              ))}
          </select>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {!loaded ? (
        <div className="text-muted">Загрузка…</div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{direction === 'outgoing' ? 'Номер' : 'Входящий номер'}</th>
                <th>Дата</th>
                <th>{direction === 'outgoing' ? 'Адресат' : 'Отправитель'}</th>
                {direction === 'incoming' && <th>Тип</th>}
                {direction === 'incoming' && <th>Адрес</th>}
                <th>Категория</th>
                {direction === 'incoming' && <th>Срок</th>}
                <th>Статус</th>
                <th>Ответственный</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="row-link" onClick={() => navigate(`/appeals/${item.id}`)}>
                  <td>{item.incoming_number}</td>
                  <td>{formatDate(item.appeal_date)}</td>
                  <td>{item.sender}</td>
                  {direction === 'incoming' && <td>{item.sender_type}</td>}
                  {direction === 'incoming' && <td>{item.object_address}</td>}
                  <td>{item.category}</td>
                  {direction === 'incoming' && <td>{item.reply_deadline ? formatDate(item.reply_deadline) : ''}</td>}
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{item.assignee?.full_name ?? ''}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={direction === 'outgoing' ? 6 : 9} className="text-muted">
                    {direction === 'outgoing' ? 'Исходящих писем пока нет' : 'Обращений пока нет'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal open={showCreate} title="Новое обращение" width={draft.mail_uid != null ? 640 : 480} onClose={() => setShowCreate(false)}>
        <form onSubmit={onCreate}>
          {createError && <div className="form-error">{createError}</div>}
          <div className="field">
            <label className="field__label">Входящий номер</label>
            <input
              className="input"
              value={draft.incoming_number}
              onChange={(e) => setDraft({ ...draft, incoming_number: e.target.value })}
              autoFocus
              required
            />
            <div className="field__hint">Номер по штампу входящих. Система свою нумерацию не ведёт.</div>
          </div>
          <div className="field">
            <label className="field__label">Дата обращения</label>
            <input
              className="input"
              type="date"
              value={draft.appeal_date}
              onChange={(e) => setDraft({ ...draft, appeal_date: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="field__label">Отправитель</label>
            <input
              className="input"
              value={draft.sender}
              onChange={(e) => setDraft({ ...draft, sender: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label">Тип отправителя</label>
            <select
              className="select"
              value={draft.sender_type}
              onChange={(e) => setDraft({ ...draft, sender_type: e.target.value })}
            >
              <option value="">Не указан</option>
              {SENDER_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Адрес объекта</label>
            <input
              className="input"
              value={draft.object_address}
              onChange={(e) => setDraft({ ...draft, object_address: e.target.value })}
              placeholder="Дом, квартира или помещение"
            />
          </div>
          <div className="field">
            <label className="field__label">Категория</label>
            <CategoryField
              value={draft.category}
              categories={lookups.categories}
              onChange={(category) => setDraft({ ...draft, category })}
            />
          </div>
          {draft.mail_uid != null && (
            <>
              <div className="field">
                <label className="field__label">Email для ответа</label>
                <input
                  className="input"
                  value={draft.reply_email}
                  onChange={(e) => setDraft({ ...draft, reply_email: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field__label">Краткое содержание</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={draft.summary}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field__label">Текст письма</label>
                <textarea
                  className="textarea"
                  rows={6}
                  value={draft.recognized_text}
                  onChange={(e) => setDraft({ ...draft, recognized_text: e.target.value })}
                />
                <div className="field__hint">Входящий номер и ответственный по-прежнему указываются вручную.</div>
              </div>
            </>
          )}
          <div className="field">
            <label className="field__label">Ответственный</label>
            <select
              className="select"
              value={draft.assignee_id ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, assignee_id: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">Не назначен</option>
              {lookups.users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={save.busy}>
              {save.busy ? <Spinner label="Сохранение…" /> : 'Создать'}
            </button>
            <button className="btn" type="button" onClick={() => setShowCreate(false)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
