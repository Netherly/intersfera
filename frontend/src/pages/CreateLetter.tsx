import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { todayInput } from '@/lib/appeal';
import { getApiError } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useBusy } from '@/lib/useBusy';
import { AddresseeField } from '@/components/AddresseeField';
import { CategoryField } from '@/components/CategoryField';
import { Spinner } from '@/components/Spinner';
import { Lookups } from '@/types';

export function CreateLetter({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const save = useBusy();
  const [error, setError] = useState('');
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(todayInput());
  const [addressee, setAddressee] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    api
      .get<Lookups>('/appeals/lookups')
      .then((res) => setLookups(res.data))
      .catch((err) => setError(getApiError(err, 'Не удалось загрузить справочники')));
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hasPermission('appeals.create')) return;
    setError('');
    save.run(async () => {
      try {
        const res = await api.post<{ id: number }>('/appeals', {
          direction: 'outgoing',
          incoming_number: number.trim(),
          appeal_date: date,
          sender: addressee.trim(),
          object_address: address.trim(),
          reply_email: email.trim(),
          category: category.trim(),
          final_reply: text,
          assignee_id: user?.id ?? null,
        });
        navigate(`/appeals/${res.data.id}`);
      } catch (err) {
        setError(getApiError(err, 'Не удалось создать письмо'));
      }
    });
  }

  return (
    <div className="stack">
      {!embedded && (
        <div className="page-header">
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Создать письмо
          </h1>
        </div>
      )}
      <p className="text-muted">
        Письмо, которое начинает компания. Оно попадёт во вкладку «Исходящие» реестра. Скан и отправка — на карточке после сохранения.
      </p>
      {error && <div className="form-error">{error}</div>}
      <form className="card" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label className="field__label">Исходящий номер</label>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field__label">Дата письма</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field field--full">
            <label className="field__label">Адресат</label>
            <AddresseeField value={addressee} email={email} onChange={setAddressee} onEmailChange={setEmail} />
          </div>
          <div className="field field--full">
            <label className="field__label">Адрес</label>
            <input
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Почтовый адрес адресата, попадёт справа на бланке"
            />
          </div>
          <div className="field">
            <label className="field__label">Категория</label>
            <CategoryField
              value={category}
              categories={lookups?.categories ?? []}
              onChange={setCategory}
            />
          </div>
          <div className="field field--full">
            <label className="field__label">Текст письма</label>
            <textarea className="textarea" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <div className="actions">
          <button className="btn btn--primary" type="submit" disabled={save.busy}>
            {save.busy ? <Spinner label="Сохранение…" /> : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  );
}
