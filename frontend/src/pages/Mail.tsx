import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, getApiError } from '@/lib/format';
import { useBusy } from '@/lib/useBusy';
import { Spinner } from '@/components/Spinner';
import { MailDraft } from '@/types';

interface MailResponse {
  configured: boolean;
  messages: MailDraft[];
}

export function Mail() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('appeals.create');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<MailDraft[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const dismiss = useBusy();

  const load = useCallback(async () => {
    if (!allowed) {
      setLoaded(true);
      return;
    }
    setError('');
    try {
      const res = await api.get<MailResponse>('/mail');
      setConfigured(res.data.configured);
      setMessages(res.data.messages);
    } catch (err) {
      setError(getApiError(err, 'Не удалось прочитать почту'));
    } finally {
      setLoaded(true);
    }
  }, [allowed]);

  useEffect(() => {
    load();
  }, [load]);

  function openAppeal(message: MailDraft) {
    navigate('/appeals', { state: { mail: message } });
  }

  function hideMessage(message: MailDraft) {
    if (!confirm('Убрать письмо из очереди? Обращение создано не будет.')) return;
    dismiss.run(async () => {
      setError('');
      try {
        await api.post('/mail/dismiss', { uid: message.uid, uid_validity: message.uid_validity });
        setMessages((current) => current.filter((item) => item.uid !== message.uid));
      } catch (err) {
        setError(getApiError(err, 'Не удалось убрать письмо'));
      }
    });
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? messages.filter((item) =>
        `${item.from} ${item.email} ${item.subject} ${item.text}`.toLowerCase().includes(needle),
      )
    : messages;

  return (
    <div className="page-fill">
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Входящая почта
        </h1>
        <button className="btn" type="button" onClick={load}>
          Обновить
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!allowed ? (
        <div className="text-muted">Недостаточно прав</div>
      ) : !loaded ? (
        <div className="text-muted">Загрузка…</div>
      ) : configured === false ? (
        <div className="card">
          Почта не настроена. Когда на сервере будут указаны IMAP_HOST, IMAP_USER и IMAP_PASSWORD, здесь появится
          очередь непрочитанных писем. Обращение из письма само не создаётся: сотрудник открывает его и сам указывает
          входящий номер и ответственного.
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="input"
              placeholder="Отправитель, тема или текст"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="field__hint" style={{ marginBottom: 12 }}>
            Показаны последние непрочитанные письма. Карточка создаётся только кнопкой «Это заявка».
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Отправитель</th>
                  <th>Тема</th>
                  <th>Текст</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={`${item.uid_validity}-${item.uid}`}>
                    <td>{item.date ? formatDateTime(item.date) : ''}</td>
                    <td>
                      <div>{item.from}</div>
                      {item.email && item.email !== item.from && <div className="text-muted">{item.email}</div>}
                    </td>
                    <td>{item.subject}</td>
                    <td>
                      <div className="mail-snippet">{item.text.slice(0, 180)}</div>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn--sm btn--primary" type="button" onClick={() => openAppeal(item)}>
                          Это заявка
                        </button>
                        <button className="btn btn--sm" type="button" onClick={() => hideMessage(item)} disabled={dismiss.busy}>
                          {dismiss.busy ? <Spinner label="…" /> : 'Не заявка'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted">
                      Непрочитанных писем нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
