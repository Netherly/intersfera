import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, getApiError } from '@/lib/format';
import { useBusy } from '@/lib/useBusy';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { CreateLetter } from '@/pages/CreateLetter';
import { MailAttachment, MailDraft } from '@/types';

interface MailResponse {
  configured: boolean;
  messages: MailDraft[];
}

const DEMO_MESSAGES: MailDraft[] = [
  {
    uid: 0,
    uid_validity: 'demo-1',
    from: 'Разова Людмила Андреевна',
    email: 'razova@example.ru',
    subject: 'Протекает крыша, РС 56 кв. 28',
    date: '2026-11-11T09:12:00.000Z',
    text: 'Добрый день. Во время дождя в квартире 28 по ул. Российская, 56 течёт с потолка в комнате. Прошу направить мастера и сообщить сроки ремонта кровли.',
    attachments: [],
  },
  {
    uid: 0,
    uid_validity: 'demo-2',
    from: 'ООО «Краснодар Водоканал»',
    email: 'info@example.ru',
    subject: 'О плановом отключении водоснабжения',
    date: '2026-11-10T13:40:00.000Z',
    text: 'Уведомляем о плановом отключении холодного водоснабжения 14.11.2026 с 9:00 до 17:00 по адресам во вложении. Просим оповестить жителей.',
    attachments: [{ index: 0, filename: 'Адреса отключения.txt', content_type: 'text/plain', size: 180 }],
  },
  {
    uid: 0,
    uid_validity: 'demo-3',
    from: 'Прокуратура Прикубанского округа',
    email: 'prokuratura@example.ru',
    subject: 'Запрос информации по обращению',
    date: '2026-11-09T07:05:00.000Z',
    text: 'В связи с поступившим обращением прошу в срок до 20.11.2026 представить сведения о работах по содержанию общего имущества МКД по ул. Коммунаров, 64. Документ во вложении.',
    attachments: [{ index: 0, filename: 'Запрос.txt', content_type: 'text/plain', size: 160 }],
  },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function Mail() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('appeals.create');
  const tab = searchParams.get('tab') === 'new' ? 'new' : 'inbox';
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<MailDraft[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [opened, setOpened] = useState<MailDraft | null>(null);
  const dismiss = useBusy();
  const download = useBusy();

  const load = useCallback(async () => {
    if (!allowed) {
      setLoaded(true);
      return;
    }
    setError('');
    try {
      const res = await api.get<MailResponse>('/mail');
      setConfigured(res.data.configured);
      setMessages(res.data.configured ? res.data.messages : DEMO_MESSAGES);
    } catch (err) {
      setError(getApiError(err, 'Не удалось прочитать почту'));
    } finally {
      setLoaded(true);
    }
  }, [allowed]);

  useEffect(() => {
    load();
  }, [load]);

  function openTab(next: 'inbox' | 'new') {
    const params = new URLSearchParams(searchParams);
    if (next === 'new') params.set('tab', 'new');
    else params.delete('tab');
    setSearchParams(params);
  }

  function openAppeal(message: MailDraft) {
    setOpened(null);
    navigate('/appeals', { state: { mail: message } });
  }

  function hideMessage(message: MailDraft) {
    if (!confirm('Убрать письмо из очереди? Обращение создано не будет.')) return;
    if (configured === false) {
      setMessages((current) => current.filter((item) => item.uid_validity !== message.uid_validity));
      setOpened(null);
      return;
    }
    dismiss.run(async () => {
      setError('');
      try {
        await api.post('/mail/dismiss', { uid: message.uid, uid_validity: message.uid_validity });
        setMessages((current) => current.filter((item) => item.uid !== message.uid));
        setOpened(null);
      } catch (err) {
        setError(getApiError(err, 'Не удалось убрать письмо'));
      }
    });
  }

  function saveFile(message: MailDraft, file: MailAttachment) {
    download.run(async () => {
      setError('');
      try {
        const res = await api.get<Blob>(`/mail/${message.uid}/attachments/${file.index}`, {
          params: { uid_validity: message.uid_validity },
          responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.filename;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(getApiError(err, 'Не удалось скачать вложение'));
      }
    });
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? messages.filter((item) => {
        const files = (item.attachments ?? []).map((file) => file.filename).join(' ');
        return `${item.from} ${item.email} ${item.subject} ${item.text} ${files}`.toLowerCase().includes(needle);
      })
    : messages;

  return (
    <div className="page-fill">
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Почта
        </h1>
        {tab === 'inbox' && (
          <button className="btn" type="button" onClick={load}>
            Обновить
          </button>
        )}
      </div>
      <div className="tabs">
        <button type="button" className={tab === 'inbox' ? 'tab tab--active' : 'tab'} onClick={() => openTab('inbox')}>
          Входящие
        </button>
        <button type="button" className={tab === 'new' ? 'tab tab--active' : 'tab'} onClick={() => openTab('new')}>
          Создать письмо
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {tab === 'new' ? (
        <CreateLetter embedded />
      ) : !allowed ? (
        <div className="text-muted">Недостаточно прав</div>
      ) : !loaded ? (
        <div className="text-muted">Загрузка…</div>
      ) : (
        <>
          {configured === false && (
            <div className="card" style={{ marginBottom: 16 }}>
              <strong>Почта не настроена — ниже пример очереди.</strong>
              <div className="text-muted" style={{ marginTop: 6 }}>
                Письма ненастоящие. Письмо открывается целиком, вместе с вложениями: документы не показываются
                отрывком. «Это заявка» откроет форму нового обращения.
              </div>
            </div>
          )}
          <div className="toolbar">
            <input
              className="input"
              placeholder="Отправитель, тема или файл"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="field__hint" style={{ marginBottom: 12 }}>
            В списке нет текста письма. Откройте его, чтобы прочитать и скачать вложения.
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Отправитель</th>
                  <th>Тема</th>
                  <th>Вложения</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const files = item.attachments ?? [];
                  return (
                    <tr key={`${item.uid_validity}-${item.uid}`}>
                      <td>{item.date ? formatDateTime(item.date) : ''}</td>
                      <td>
                        <div>{item.from}</div>
                        {item.email && item.email !== item.from && <div className="text-muted">{item.email}</div>}
                      </td>
                      <td>{item.subject}</td>
                      <td>
                        {files.length === 0 ? (
                          <span className="text-muted">Нет</span>
                        ) : (
                          <div className="file-list">
                            {files.map((file) => (
                              <span key={file.index} className="file-chip" title={file.filename}>
                                {file.filename}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          <button className="btn btn--sm" type="button" onClick={() => setOpened(item)}>
                            Открыть
                          </button>
                          <button className="btn btn--sm btn--primary" type="button" onClick={() => openAppeal(item)}>
                            Это заявка
                          </button>
                          <button className="btn btn--sm" type="button" onClick={() => hideMessage(item)} disabled={dismiss.busy}>
                            {dismiss.busy ? <Spinner label="…" /> : 'Не заявка'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      <Modal open={opened !== null} title={opened?.subject || 'Письмо'} width={760} onClose={() => setOpened(null)}>
        {opened && (
          <div className="stack">
            <div className="text-muted">
              {opened.from}
              {opened.email ? ` · ${opened.email}` : ''}
              {opened.date ? ` · ${formatDateTime(opened.date)}` : ''}
            </div>
            {opened.text ? <pre className="mail-body">{opened.text}</pre> : <div className="text-muted">В письме нет текста.</div>}
            <div>
              <div className="field__label">Вложения</div>
              {(opened.attachments ?? []).length === 0 ? (
                <div className="text-muted">Файлов нет</div>
              ) : (
                <ul className="mail-files">
                  {(opened.attachments ?? []).map((file) => (
                    <li key={file.index}>
                      <span>
                        {file.filename}
                        <span className="text-muted"> · {formatSize(file.size)}</span>
                      </span>
                      <button className="btn btn--sm" type="button" onClick={() => saveFile(opened, file)} disabled={download.busy}>
                        {download.busy ? <Spinner label="…" /> : 'Скачать'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="field__hint">Документы скачиваются файлом и не открываются предпросмотром.</div>
            </div>
            <div className="actions">
              <button className="btn btn--primary" type="button" onClick={() => openAppeal(opened)}>
                Это заявка
              </button>
              <button className="btn" type="button" onClick={() => hideMessage(opened)} disabled={dismiss.busy}>
                Не заявка
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
