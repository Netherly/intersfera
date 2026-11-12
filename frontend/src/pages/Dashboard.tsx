import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { DEPARTMENTS, DepartmentId } from '@/lib/departments';
import { formatDate, getApiError } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardAppeal, DashboardData } from '@/types';

function CountTable({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  return (
    <div className="card">
      <h2 className="section-title">{title}</h2>
      <table className="table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.count}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="text-muted">Пока нет обращений</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AppealRows({ rows }: { rows: DashboardAppeal[] }) {
  const navigate = useNavigate();
  if (rows.length === 0) {
    return <div className="text-muted">Нет таких обращений</div>;
  }
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Номер</th>
            <th>Дата</th>
            <th>Отправитель</th>
            <th>Категория</th>
            <th>Срок</th>
            <th>Статус</th>
            <th>Ответственный</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="row-link" onClick={() => navigate(`/appeals/${row.id}`)}>
              <td>{row.incoming_number}</td>
              <td>{formatDate(row.appeal_date)}</td>
              <td>{row.sender}</td>
              <td>{row.category}</td>
              <td className={row.overdue ? 'status-error' : undefined}>
                {row.reply_deadline ? formatDate(row.reply_deadline) : ''}
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>{row.assignee}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard() {
  const { hasPermission, hasDepartment } = useAuth();
  const seesNeutral = hasPermission('appeals.view_unassigned');
  const visible = DEPARTMENTS.filter((item) => hasDepartment(item.id));
  const [tab, setTab] = useState<DepartmentId>(visible[0]?.id ?? 'appeals');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const showAppeals = tab === 'appeals' && hasPermission('appeals.view');

  useEffect(() => {
    if (!showAppeals) return;
    api
      .get<DashboardData>('/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(getApiError(err, 'Не удалось загрузить статистику')));
  }, [showAppeals]);

  const tabLabel = visible.find((item) => item.id === tab)?.label ?? 'Отдел';

  return (
    <div>
      <h1 className="page-title">Статистика</h1>
      {visible.length > 0 && (
        <div className="tabs">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === tab ? 'tab tab--active' : 'tab'}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {!showAppeals && (
        <div className="card">
          <h2 className="section-title">{tabLabel}</h2>
          <p>Статистика отдела появится вместе с его модулем.</p>
        </div>
      )}
      {showAppeals && error && <p className="status-error">{error}</p>}
      {showAppeals && !error && !data && <p className="text-muted">Загрузка…</p>}
      {showAppeals && data && (
      <>
      <div className="stats-grid">
        <Link className="stat-card" to="/appeals">
          <div className="stat-card__label">Всего обращений</div>
          <div className="stat-card__value">{data.total}</div>
        </Link>
        {data.by_status.map((row) => (
          <Link key={row.status} className="stat-card" to={`/appeals?status=${encodeURIComponent(row.status)}`}>
            <div className="stat-card__label">{row.status}</div>
            <div className="stat-card__value">{row.count}</div>
          </Link>
        ))}
        {seesNeutral && (
          <Link className="stat-card" to="/appeals?unassigned=1">
            <div className="stat-card__label">Нейтральные</div>
            <div className="stat-card__value">{data.unassigned}</div>
          </Link>
        )}
        <div className="stat-card">
          <div className="stat-card__label">Срок ответа прошёл</div>
          <div className="stat-card__value">{data.overdue}</div>
        </div>
        <Link className="stat-card" to="/appeals?direction=outgoing">
          <div className="stat-card__label">Исходящие письма</div>
          <div className="stat-card__value">{data.outgoing}</div>
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Новые обращения</h2>
        <AppealRows rows={data.fresh} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Сроки ответа</h2>
        <div className="text-muted" style={{ marginBottom: 12 }}>
          Незавершённые обращения, у которых срок уже прошёл или наступит в ближайшие 14 дней.
        </div>
        <AppealRows rows={data.deadlines} />
      </div>

      <div className="dashboard-cols">
        <CountTable title="По типу отправителя" rows={data.by_sender_type} />
        <CountTable title="По категории" rows={data.by_category} />
      </div>
      </>
      )}
    </div>
  );
}
