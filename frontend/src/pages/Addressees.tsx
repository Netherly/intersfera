import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { useBusy } from '@/lib/useBusy';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { AddresseeRow } from '@/types';

export function AddresseeAdmin() {
  const [rows, setRows] = useState<AddresseeRow[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const save = useBusy();

  const load = useCallback(async () => {
    const res = await api.get<AddresseeRow[]>('/addressees');
    setRows(res.data);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(getApiError(err, 'Не удалось загрузить адресатов')));
  }, [load]);

  function startCreate() {
    setEditId(null);
    setName('');
    setEmail('');
    setError('');
    setShowForm(true);
  }

  function startEdit(row: AddresseeRow) {
    setEditId(row.id);
    setName(row.name);
    setEmail(row.email);
    setError('');
    setShowForm(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    save.run(async () => {
      try {
        if (editId) await api.patch(`/addressees/${editId}`, { name: name.trim(), email: email.trim() });
        else await api.post('/addressees', { name: name.trim(), email: email.trim() });
        setShowForm(false);
        await load();
      } catch (err) {
        setError(getApiError(err, 'Не удалось сохранить адресата'));
      }
    });
  }

  async function toggle(row: AddresseeRow) {
    setError('');
    try {
      await api.patch(`/addressees/${row.id}`, { is_active: !row.is_active });
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось изменить адресата'));
    }
  }

  async function remove(row: AddresseeRow) {
    if (!confirm(`Удалить адресата «${row.name}»?`)) return;
    setError('');
    try {
      await api.delete(`/addressees/${row.id}`);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось удалить адресата'));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="text-muted">Имя и почта для исходящих писем. В письме их можно поправить, не меняя справочник.</div>
        <button className="btn btn--primary" onClick={startCreate}>
          Добавить
        </button>
      </div>
      {error && !showForm && <div className="form-error">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Почта</th>
            <th>Писем</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.email}</td>
              <td>{row.letters_count}</td>
              <td>
                {row.is_active ? (
                  <span className="badge badge--green badge--status">Активен</span>
                ) : (
                  <span className="badge badge--gray badge--status">Отключён</span>
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
              <td colSpan={5} className="text-muted">
                Адресатов пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Modal open={showForm} title={editId ? 'Адресат' : 'Новый адресат'} width={420} onClose={() => setShowForm(false)}>
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">Название</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label className="field__label">Почта</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
