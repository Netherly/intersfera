import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MATERIAL_KINDS } from '@/lib/appeal';
import { getApiError } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useBusy } from '@/lib/useBusy';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { Material } from '@/types';

type Kind = Material['kind'];

interface FormState {
  id: number | null;
  title: string;
  citation: string;
  body: string;
}

const emptyForm: FormState = { id: null, title: '', citation: '', body: '' };

export function Materials() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('materials.edit');
  const [kind, setKind] = useState<Kind>('norm');
  const [rows, setRows] = useState<Material[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const save = useBusy();

  const load = useCallback(async () => {
    const res = await api.get<Material[]>('/materials', { params: { kind } });
    setRows(res.data);
  }, [kind]);

  useEffect(() => {
    load().catch((err) => setError(getApiError(err, 'Не удалось загрузить базу')));
  }, [load]);

  function startCreate() {
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function startEdit(row: Material) {
    setForm({ id: row.id, title: row.title, citation: row.citation, body: row.body });
    setError('');
    setShowForm(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    save.run(async () => {
      try {
        const payload = { title: form.title.trim(), citation: form.citation.trim(), body: form.body };
        if (form.id) await api.patch(`/materials/${form.id}`, payload);
        else await api.post('/materials', { kind, ...payload });
        setShowForm(false);
        await load();
      } catch (err) {
        setError(getApiError(err, 'Не удалось сохранить'));
      }
    });
  }

  async function toggle(row: Material) {
    setError('');
    try {
      await api.patch(`/materials/${row.id}`, { is_active: !row.is_active });
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось изменить запись'));
    }
  }

  async function remove(row: Material) {
    if (!confirm(`Удалить «${row.title}»?`)) return;
    setError('');
    try {
      await api.delete(`/materials/${row.id}`);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось удалить запись'));
    }
  }

  const kindLabel = MATERIAL_KINDS.find((item) => item.kind === kind)?.label ?? '';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Базы
        </h1>
        {canEdit && (
          <button className="btn btn--primary" onClick={startCreate}>
            Добавить
          </button>
        )}
      </div>

      <div className="tabs">
        {MATERIAL_KINDS.map((item) => (
          <button
            key={item.kind}
            type="button"
            className={item.kind === kind ? 'tab tab--active' : 'tab'}
            onClick={() => setKind(item.kind)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="text-muted" style={{ marginBottom: 16 }}>
        {kind === 'norm'
          ? 'Полный текст акта — опора для ответа, если он внесён. Пока текста нет, остаются название и указанные статьи. Ответ может опираться и на другие действующие законы, когда они нужны по сути дела.'
          : kind === 'example'
            ? 'Исходящие письма из папки примеров. Этот текст можно брать за образец ответа.'
            : 'Короткие абзацы, которые можно вставлять в ответ. Пока раздел пустой.'}
      </div>
      {error && !showForm && <div className="form-error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Статьи и пункты</th>
            <th>Текст</th>
            <th>Статус</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.title}</td>
              <td>{row.citation}</td>
              <td>
                {row.body.trim() ? (
                  <span className="badge badge--green badge--text">Есть текст</span>
                ) : (
                  <span className="badge badge--gray badge--text">Только название</span>
                )}
              </td>
              <td>
                {row.is_active ? (
                  <span className="badge badge--green badge--status">Активна</span>
                ) : (
                  <span className="badge badge--gray badge--status">Отключена</span>
                )}
              </td>
              {canEdit && (
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
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 5 : 4} className="text-muted">
                В разделе «{kindLabel}» пока пусто
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal open={showForm} title={form.id ? 'Запись базы' : 'Новая запись'} width={720} onClose={() => setShowForm(false)}>
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">Название</label>
            <textarea
              className="textarea"
              rows={3}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="field__label">Статьи и пункты</label>
            <input
              className="input"
              value={form.citation}
              onChange={(e) => setForm({ ...form, citation: e.target.value })}
              placeholder="Если нужно ограничить фрагмент, например статья 22"
            />
          </div>
          <div className="field">
            <label className="field__label">Полный текст или фрагмент</label>
            <textarea
              className="textarea"
              rows={12}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            <div className="field__hint">
              Можно оставить пустым. Тогда в базе останется только название. Текст стоит вставить, если ответ должен держаться формулировок документа.
            </div>
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
