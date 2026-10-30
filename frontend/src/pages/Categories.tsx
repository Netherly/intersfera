import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { useBusy } from '@/lib/useBusy';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { CategoryRow } from '@/types';

export function Categories() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const save = useBusy();

  const load = useCallback(async () => {
    const res = await api.get<CategoryRow[]>('/categories');
    setRows(res.data);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(getApiError(err, 'Не удалось загрузить категории')));
  }, [load]);

  function startCreate() {
    setEditId(null);
    setName('');
    setError('');
    setShowForm(true);
  }

  function startEdit(row: CategoryRow) {
    setEditId(row.id);
    setName(row.name);
    setError('');
    setShowForm(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    save.run(async () => {
      try {
        if (editId) await api.patch(`/categories/${editId}`, { name: name.trim() });
        else await api.post('/categories', { name: name.trim() });
        setShowForm(false);
        await load();
      } catch (err) {
        setError(getApiError(err, 'Не удалось сохранить категорию'));
      }
    });
  }

  async function toggle(row: CategoryRow) {
    setError('');
    try {
      await api.patch(`/categories/${row.id}`, { is_active: !row.is_active });
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось изменить категорию'));
    }
  }

  async function remove(row: CategoryRow) {
    if (!confirm(`Удалить категорию «${row.name}»?`)) return;
    setError('');
    try {
      await api.delete(`/categories/${row.id}`);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось удалить категорию'));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Категории
        </h1>
        <button className="btn btn--primary" onClick={startCreate}>
          Добавить
        </button>
      </div>
      <div className="text-muted" style={{ marginBottom: 16 }}>
        Справочник для карточки обращения. Новое название можно ввести и прямо в карточке.
      </div>
      {error && !showForm && <div className="form-error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Обращений</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.appeals_count}</td>
              <td>
                {row.is_active ? (
                  <span className="badge badge--green">Активна</span>
                ) : (
                  <span className="badge badge--gray">Отключена</span>
                )}
              </td>
              <td style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--sm" onClick={() => startEdit(row)}>
                  Изменить
                </button>
                <button className="btn btn--sm" onClick={() => toggle(row)}>
                  {row.is_active ? 'Отключить' : 'Включить'}
                </button>
                <button className="btn btn--sm btn--danger" onClick={() => remove(row)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted">
                Категорий пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal
        open={showForm}
        title={editId ? 'Категория' : 'Новая категория'}
        width={420}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">Название</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={save.busy}>
              {save.busy ? <Spinner label="Сохранение…" /> : 'Сохранить'}
            </button>
            <button className="btn" type="button" onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
