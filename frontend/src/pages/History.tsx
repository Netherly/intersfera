import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, getApiError } from '@/lib/format';
import { AdminEventText, AppealEventText } from '@/components/EventText';
import { Lookups } from '@/types';

type Source = 'all' | 'incoming' | 'outgoing' | 'admin';

interface HistoryItem {
  key: string;
  source: 'incoming' | 'outgoing' | 'admin';
  created_at: string;
  user: { id: number; full_name: string } | null;
  action: string;
  payload: unknown;
  appeal: { id: number; number: string; sender: string } | null;
  entity: string | null;
  title: string;
}

interface HistoryPage {
  items: HistoryItem[];
  next_before: string | null;
}

const SOURCE_LABELS: Record<HistoryItem['source'], string> = {
  incoming: 'Входящие',
  outgoing: 'Исходящие',
  admin: 'Настройки',
};

export function History() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const [source, setSource] = useState<Source>('all');
  const [userId, setUserId] = useState('');
  const [people, setPeople] = useState<Lookups['users']>([]);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    async (before?: string) => {
      const params: Record<string, string> = { source };
      if (userId) params.user_id = userId;
      if (before) params.before = before;
      const res = await api.get<HistoryPage>('/history', { params });
      return res.data;
    },
    [source, userId],
  );

  useEffect(() => {
    setLoaded(false);
    setError('');
    fetchPage()
      .then((page) => {
        setItems(page.items);
        setNext(page.next_before);
      })
      .catch((err) => setError(getApiError(err, 'Не удалось загрузить историю')))
      .finally(() => setLoaded(true));
  }, [fetchPage]);

  useEffect(() => {
    api
      .get<Lookups>('/appeals/lookups')
      .then((res) => setPeople(res.data.users))
      .catch(() => setPeople([]));
  }, []);

  async function loadMore() {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(next);
      setItems((current) => [...current, ...page.items]);
      setNext(page.next_before);
    } catch (err) {
      setError(getApiError(err, 'Не удалось загрузить историю'));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">История</h1>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Все действия по проекту, сначала новые.{' '}
        {isAdmin
          ? 'Супер-админ видит и действия в настройках: пользователи, роли, справочники, базы.'
          : 'Видны действия по обращениям и письмам, которые доступны вам.'}
      </p>

      <div className="toolbar">
        <select className="select" value={source} onChange={(e) => setSource(e.target.value as Source)}>
          <option value="all">Все разделы</option>
          <option value="incoming">Входящие</option>
          <option value="outgoing">Исходящие</option>
          {isAdmin && <option value="admin">Настройки</option>}
        </select>
        {isAdmin && (
          <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Все сотрудники</option>
            {people.map((person) => (
              <option key={person.id} value={String(person.id)}>
                {person.full_name}
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
                <th>Когда</th>
                <th>Кто</th>
                <th>Раздел</th>
                <th>Запись</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(item.created_at)}</td>
                  <td>{item.user?.full_name ?? 'Удалённый пользователь'}</td>
                  <td>{SOURCE_LABELS[item.source]}</td>
                  <td>
                    {item.appeal ? (
                      <Link to={`/appeals/${item.appeal.id}`}>
                        {item.appeal.number}
                        {item.appeal.sender ? ` · ${item.appeal.sender}` : ''}
                      </Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {item.appeal ? (
                      <AppealEventText action={item.action} payload={item.payload} />
                    ) : (
                      <AdminEventText
                        action={item.action}
                        entity={item.entity ?? ''}
                        title={item.title}
                        payload={item.payload}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted">
                    Действий пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {next && (
        <div style={{ marginTop: 12 }}>
          <button className="btn" type="button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Загрузка…' : 'Показать ещё'}
          </button>
        </div>
      )}
    </div>
  );
}
