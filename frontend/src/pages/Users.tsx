import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { useBusy } from '@/lib/useBusy';
import { DEPARTMENTS } from '@/lib/departments';
import { AppRole, User } from '@/types';

interface FormState {
  id: number | null;
  full_name: string;
  login: string;
  password: string;
  role: 'user' | 'super_admin';
  role_id: number | null;
  departments: string[];
}

const emptyForm: FormState = {
  id: null,
  full_name: '',
  login: '',
  password: '',
  role: 'user',
  role_id: null,
  departments: ['appeals'],
};

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const save = useBusy();

  async function load() {
    const [userRes, roleRes] = await Promise.all([api.get<User[]>('/users'), api.get<AppRole[]>('/roles')]);
    setUsers(userRes.data);
    setRoles(roleRes.data);
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function startEdit(user: User) {
    setForm({
      id: user.id,
      full_name: user.full_name,
      login: user.login,
      password: '',
      role: user.role,
      role_id: user.role_id,
      departments: user.role === 'super_admin' ? [] : user.departments ?? [],
    });
    setError('');
    setShowForm(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (form.role === 'user' && !form.role_id) {
      setError('Выберите роль пользователя');
      return;
    }
    if (form.role === 'user' && form.departments.length === 0) {
      setError('Выберите хотя бы один отдел');
      return;
    }
    save.run(async () => {
      try {
        if (form.id) {
          const payload: Record<string, unknown> = {
            full_name: form.full_name,
            login: form.login,
            role: form.role,
            role_id: form.role === 'super_admin' ? null : form.role_id,
            departments: form.role === 'super_admin' ? [] : form.departments,
          };
          if (form.password) payload.password = form.password;
          await api.patch(`/users/${form.id}`, payload);
        } else {
          await api.post('/users', {
            full_name: form.full_name,
            login: form.login,
            password: form.password,
            role: form.role,
            role_id: form.role === 'super_admin' ? null : form.role_id,
            departments: form.role === 'super_admin' ? [] : form.departments,
          });
        }
        setShowForm(false);
        await load();
      } catch (err) {
        setError(getApiError(err, 'Ошибка сохранения'));
      }
    });
  }

  async function archive(user: User) {
    if (!confirm(`Заблокировать пользователя «${user.full_name}»?`)) return;
    await api.patch(`/users/${user.id}`, { is_active: false });
    await load();
  }

  async function activate(user: User) {
    await api.patch(`/users/${user.id}`, { is_active: true });
    await load();
  }

  async function remove(user: User) {
    if (!confirm(`Удалить пользователя «${user.full_name}» безвозвратно?`)) return;
    setError('');
    try {
      await api.delete(`/users/${user.id}`);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось удалить пользователя'));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Пользователи</h1>
        <button className="btn btn--primary" onClick={startCreate}>
          Добавить
        </button>
      </div>

      {error && !showForm && <div className="form-error">{error}</div>}

      <Modal
        open={showForm}
        title={form.id ? 'Редактирование пользователя' : 'Новый пользователь'}
        width={460}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">ФИО</label>
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label">Логин</label>
            <input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
          </div>
          <div className="field">
            <label className="field__label">
              Пароль {form.id && <span className="text-muted">(оставьте пустым, чтобы не менять)</span>}
            </label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label">Роль</label>
            <select
              className="select"
              value={form.role === 'super_admin' ? 'super' : String(form.role_id ?? '')}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'super') setForm({ ...form, role: 'super_admin', role_id: null });
                else setForm({ ...form, role: 'user', role_id: value ? Number(value) : null });
              }}
            >
              <option value="" disabled>
                Выберите роль
              </option>
              <option value="super">Супер-админ (полный доступ)</option>
              {roles
                .filter((role) => role.id > 0)
                .map((role) => (
                  <option key={role.id} value={String(role.id)}>
                    {role.name}
                  </option>
                ))}
            </select>
          </div>
          {form.role === 'user' && (
            <div className="field">
              <label className="field__label">Отделы</label>
              <div className="check-row">
                {DEPARTMENTS.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={form.departments.includes(item.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.departments, item.id]
                          : form.departments.filter((id) => id !== item.id);
                        setForm({ ...form, departments: next });
                      }}
                    />{' '}
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" type="submit" disabled={save.busy}>
              {save.busy ? <Spinner label="Сохранение…" /> : 'Сохранить'}
            </button>
            <button className="btn" type="button" onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>

      <table className="table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Логин</th>
            <th>Роль</th>
            <th>Отделы</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.full_name}</td>
              <td>{user.login}</td>
              <td>{user.role === 'super_admin' ? 'Супер-админ' : user.role_name ?? ''}</td>
              <td>
                {user.role === 'super_admin'
                  ? 'Все'
                  : DEPARTMENTS.filter((item) => user.departments?.includes(item.id))
                      .map((item) => item.label)
                      .join(', ')}
              </td>
              <td>
                {user.is_active ? (
                  <span className="badge badge--green">Активен</span>
                ) : (
                  <span className="badge badge--gray">Заблокирован</span>
                )}
              </td>
              <td style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--sm" onClick={() => startEdit(user)}>
                  Изменить
                </button>
                {user.is_active ? (
                  <button className="btn btn--sm btn--danger" onClick={() => archive(user)}>
                    Заблокировать
                  </button>
                ) : (
                  <button className="btn btn--sm" onClick={() => activate(user)}>
                    Разблокировать
                  </button>
                )}
                <button className="btn btn--sm btn--danger" onClick={() => remove(user)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
